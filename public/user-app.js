import { createWorkflowApiClient } from "./workflow-api-client.js";
import { createWorkflowPageTaskDraftAssistantCommands } from "./workflow-page-task-draft-assistant-commands.js";
import { buildStageTimelineSectionViewModel } from "./stage-timeline-section-view-model.js";

function createElement(documentRef, tagName, {
  className = "",
  id = "",
  textContent = "",
  attributes = {},
} = {}) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  if (id) element.id = id;
  if (textContent) element.textContent = textContent;
  for (const [name, value] of Object.entries(attributes)) {
    if (typeof element.setAttribute === "function") {
      element.setAttribute(name, value);
    } else {
      element[name] = value;
    }
  }
  return element;
}

function createButton(documentRef, {
  id,
  className = "user-button",
  textContent,
  disabled = false,
} = {}) {
  const button = createElement(documentRef, "button", {
    id,
    className,
    textContent,
    attributes: { type: "button" },
  });
  button.disabled = disabled;
  return button;
}

function taskTitle(entry) {
  return entry?.title
    ?? entry?.taskDraft?.name
    ?? entry?.taskDraft?.id
    ?? entry?.id
    ?? "未命名任务";
}

function taskMeta(entry) {
  const source = entry?.sourceFile ?? entry?.sourcePath ?? entry?.packageId ?? "";
  const stage = entry?.currentWorkStage ?? entry?.status ?? entry?.type ?? "";
  return [source, stage].filter(Boolean).join(" · ") || "任务池条目";
}

function renderTaskPoolList({
  documentRef,
  listElement,
  countElement,
  entries = [],
  selectedPackageId = null,
  onSelectPackage = () => {},
}) {
  countElement.textContent = `${entries.length} 个任务`;
  listElement.replaceChildren();

  if (entries.length === 0) {
    listElement.append(createElement(documentRef, "p", {
      className: "empty-state",
      textContent: "任务池里还没有任务。",
    }));
    return;
  }

  for (const entry of entries) {
    const item = createElement(documentRef, "button", {
      className: `task-pool-item${entry.packageId === selectedPackageId ? " active" : ""}`,
      attributes: { type: "button" },
    });
    item.append(
      createElement(documentRef, "h3", { textContent: taskTitle(entry) }),
      createElement(documentRef, "p", { textContent: taskMeta(entry) }),
    );
    item.addEventListener("click", () => onSelectPackage(entry.packageId));
    listElement.append(item);
  }
}

function selectInitialPackageId({ previousPackageId, entries = [], packages = [] }) {
  if (packages.some((taskPackage) => taskPackage.packageId === previousPackageId)) {
    return previousPackageId;
  }

  const activePackage = packages.find((taskPackage) => taskPackage.currentWorkStage !== "task-pool");
  if (activePackage) return activePackage.packageId;

  return entries[0]?.packageId ?? packages[0]?.packageId ?? null;
}

function recommendationStatusText(recommendationRun) {
  if (!recommendationRun) return "未运行";
  const status = recommendationRun.taskRecommender?.status ?? recommendationRun.status;
  if (status === "running") return "推荐中";
  if (status === "succeeded") return "已推荐";
  if (status === "blocked") return "已阻塞";
  if (status === "cancelled") return "已取消";
  if (status === "failed") return "失败";
  if (recommendationRun.exitCode === 0) return "已推荐";
  return status ?? "未知";
}

function recommendationSummaryText(recommendationRun) {
  if (!recommendationRun) return "等待从任务池中推荐一个可执行任务。";
  const selectedPackageId = recommendationRun.taskRecommender?.selectedPackageId
    ?? recommendationRun.executionIntent?.recommendedPackageId
    ?? recommendationRun.executionIntentAppendRequest?.packageId
    ?? null;
  if (selectedPackageId) {
    return `推荐：${fileNameFromPath(selectedPackageId)}`;
  }
  if (recommendationRun.executionIntentError) {
    return `解析失败：${recommendationRun.executionIntentError}`;
  }
  if (recommendationRun.taskRecommender?.error) return recommendationRun.taskRecommender.error;
  if (recommendationRun.error) return recommendationRun.error;
  if (recommendationRun.taskRecommender?.status === "running" || recommendationRun.status === "running") {
    return "推荐器正在分析任务池。";
  }
  return "本次运行没有产生推荐结果。";
}

function renderRecommendationPanel({
  recommendationRun,
  runButton,
  statusElement,
  summaryElement,
}) {
  statusElement.textContent = recommendationStatusText(recommendationRun);
  summaryElement.textContent = recommendationSummaryText(recommendationRun);
  runButton.disabled = recommendationRun?.status === "running";
}

function stageStatusText(className) {
  if (className.includes("current")) return "当前";
  if (className.includes("completed")) return "已完成";
  if (className.includes("skipped")) return "未进入";
  return "待处理";
}

const EVIDENCE_LABELS = {
  admissionRejection: "执行准入拒绝",
  autoMergeFailure: "自动合并失败记录",
  autoMergePlan: "自动合并计划",
  autoMergeRejection: "自动合并拒绝记录",
  autoMergeResult: "自动合并结果",
  convergenceAdvice: "收敛建议",
  convergenceFailure: "收敛失败结论",
  convergenceSuccess: "收敛成功结论",
  executionAuthorization: "执行授权",
  executionIntent: "执行意图",
  humanConvergenceGuidance: "人工修正意见",
  humanDecision: "人工决策结果",
  humanDecisionRequest: "人工决策请求",
  isolatedWorkspace: "隔离工作区",
  taskCloseout: "任务收尾记录",
  taskContextPackage: "任务上下文包",
};

const AGENT_RUN_LABELS = {
  "execution-agent": "Execution Agent 运行",
  "main-agent": "Main Agent 运行",
  "review-agent": "Review Agent 运行",
};

function artifactRecordsFromValue(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function allArtifactRecords(taskContextPackage) {
  return Object.entries(taskContextPackage?.artifacts ?? {}).flatMap(([artifactType, value]) =>
    artifactRecordsFromValue(value).map((artifact) => ({ artifactType, artifact })),
  );
}

function artifactRecordByEvidence(taskContextPackage, evidenceRef) {
  const text = String(evidenceRef ?? "").trim();
  if (!text) return null;

  const records = allArtifactRecords(taskContextPackage);
  return records.find(({ artifact }) => artifact?.artifactId === text)
    ?? records.find(({ artifactType }) => artifactType === text)
    ?? records.find(({ artifactType }) => artifactType === text.split(":")[0])
    ?? null;
}

function artifactRecordByAgentRunEvidence(taskContextPackage, evidenceRef) {
  const text = String(evidenceRef ?? "").trim();
  const executionMatch = text.match(/^execution-agent:(.+)$/);
  if (executionMatch) {
    return artifactRecordByEvidence(taskContextPackage, `executionReport:${executionMatch[1]}`);
  }
  const reviewMatch = text.match(/^review-agent:(.+)$/);
  if (reviewMatch) {
    return artifactRecordByEvidence(taskContextPackage, `reviewReport:${reviewMatch[1]}`);
  }
  return null;
}

function fileNameFromPath(value) {
  return String(value ?? "").split(/[\\/]/).filter(Boolean).at(-1) ?? "";
}

function formatEvidencePart(value) {
  const text = String(value ?? "").trim();
  if (!text) return "无";

  const packageMatch = text.match(/^task-context-package:tasks\/(.+)$/);
  if (packageMatch) return `任务上下文包：${fileNameFromPath(packageMatch[1])}`;

  const agentRunMatch = text.match(/^(main-agent|execution-agent|review-agent):(.+)$/);
  if (agentRunMatch) {
    const [, agent, run] = agentRunMatch;
    return `${AGENT_RUN_LABELS[agent]}：${run}`;
  }

  const artifactMatch = text.match(/^([A-Za-z][A-Za-z0-9]*)(?::(.+))?$/);
  if (artifactMatch) {
    const [, artifactType, suffix] = artifactMatch;
    const label = EVIDENCE_LABELS[artifactType] ?? artifactType;
    return suffix ? `${label}：${suffix}` : label;
  }

  return text;
}

function formatRawArtifactEvidence(record) {
  return JSON.stringify(record.artifact?.body ?? record.artifact ?? null, null, 2);
}

function formatEvidenceText(value, taskContextPackage = null) {
  const text = String(value ?? "").trim();
  if (!text) return "无";

  const currentPrefix = "当前 · ";
  if (text.startsWith(currentPrefix)) {
    return formatEvidenceText(text.slice(currentPrefix.length), taskContextPackage);
  }

  if (text.includes(" -> ")) {
    return text.split(" -> ").map((part) => formatEvidenceText(part, taskContextPackage)).join("\n---\n");
  }

  const record = artifactRecordByEvidence(taskContextPackage, text)
    ?? artifactRecordByAgentRunEvidence(taskContextPackage, text);
  if (record) {
    return formatRawArtifactEvidence(record);
  }

  return text;
}

function defaultSelectedStageIndex(nodes) {
  const currentIndex = nodes.findIndex((node) => node.className.includes("current"));
  if (currentIndex >= 0) return currentIndex;
  const completedIndex = nodes.findLastIndex?.((node) => node.className.includes("completed")) ?? -1;
  if (completedIndex >= 0) return completedIndex;
  return nodes.length > 0 ? 0 : null;
}

function renderStageDetail(documentRef, node, transition, taskContextPackage) {
  const detail = createElement(documentRef, "section", { className: "compact-stage-detail" });
  if (!node) {
    detail.append(createElement(documentRef, "p", {
      className: "empty-state",
      textContent: "选择一个状态节点查看详情。",
    }));
    return detail;
  }

  const rows = [
    ["阶段", node.stage],
    ["时间", node.timestampText],
    ["证据", formatEvidenceText(node.detail, taskContextPackage)],
  ];
  const list = createElement(documentRef, "dl", { className: "compact-stage-detail-list" });
  for (const [label, value] of rows) {
    list.append(
      createElement(documentRef, "dt", { textContent: label }),
      createElement(documentRef, "dd", { textContent: value }),
    );
  }

  detail.append(
    createElement(documentRef, "h3", { textContent: node.label }),
    list,
  );
  return detail;
}

function renderStageTimeline({
  documentRef,
  timelinePanel,
  timelineStatus,
  taskContextPackage,
  selectedNodeIndex,
  onSelectNode,
}) {
  const viewModel = buildStageTimelineSectionViewModel(taskContextPackage);
  timelineStatus.textContent = viewModel.statusText;
  timelinePanel.replaceChildren();

  if (viewModel.emptyText) {
    timelinePanel.append(createElement(documentRef, "p", {
      className: "empty-state",
      textContent: viewModel.emptyText,
    }));
    return viewModel;
  }

  const activeIndex = selectedNodeIndex ?? defaultSelectedStageIndex(viewModel.nodes);
  const timeline = createElement(documentRef, "div", { className: "compact-timeline" });
  const track = createElement(documentRef, "div", { className: "compact-timeline-track" });

  viewModel.nodes.forEach((node, index) => {
    const status = stageStatusText(node.className);
    const item = createElement(documentRef, "button", {
      className: `compact-stage-node ${node.className.replaceAll("stage-timeline-node ", "")}${index === activeIndex ? " active" : ""}`,
      attributes: {
        type: "button",
        "aria-pressed": index === activeIndex ? "true" : "false",
      },
    });
    item.append(
      createElement(documentRef, "span", { textContent: node.indexText }),
      createElement(documentRef, "strong", { textContent: node.label }),
      createElement(documentRef, "small", { textContent: status }),
    );
    item.addEventListener("click", () => onSelectNode(index));
    track.append(item);
  });

  timeline.append(
    track,
    renderStageDetail(
      documentRef,
      viewModel.nodes[activeIndex],
      viewModel.transitions[Math.max(0, activeIndex - 1)] ?? viewModel.transitions[activeIndex],
      taskContextPackage,
    ),
  );
  if (viewModel.notes.length > 0) {
    const notes = createElement(documentRef, "div", { className: "compact-stage-notes" });
    for (const note of viewModel.notes) {
      notes.append(createElement(documentRef, "span", { textContent: note }));
    }
    timeline.append(notes);
  }
  timelinePanel.append(timeline);
  return viewModel;
}

function appendField(documentRef, parent, { label, value }) {
  if (!value) return;
  const field = createElement(documentRef, "div", { className: "parsed-task-field" });
  field.append(
    createElement(documentRef, "span", { textContent: label }),
    createElement(documentRef, "p", { textContent: String(value) }),
  );
  parent.append(field);
}

function renderParsedTaskDraftOutput({ documentRef = document, outputElement, taskDraft }) {
  const parsed = taskDraft?.validation?.parsed;
  outputElement.replaceChildren();

  if (!parsed) {
    outputElement.textContent = taskDraft?.taskSourceText ?? "敲定后展示解析后的任务内容。";
    return;
  }

  const header = createElement(documentRef, "div", { className: "parsed-task-header" });
  header.append(
    createElement(documentRef, "h3", { textContent: parsed.title ?? parsed.id ?? "未命名任务" }),
    createElement(documentRef, "p", { textContent: parsed.id ?? "未设置 ID" }),
  );

  const chips = createElement(documentRef, "div", { className: "parsed-task-chips" });
  for (const value of [parsed.type, parsed.priority].filter(Boolean)) {
    chips.append(createElement(documentRef, "span", { textContent: value }));
  }

  const body = createElement(documentRef, "div", { className: "parsed-task-body" });
  appendField(documentRef, body, { label: "任务说明", value: parsed.description });

  const acceptance = Array.isArray(parsed.acceptance) ? parsed.acceptance : [];
  if (acceptance.length > 0) {
    const field = createElement(documentRef, "div", { className: "parsed-task-field" });
    const list = createElement(documentRef, "ul", { className: "parsed-acceptance-list" });
    for (const item of acceptance) {
      list.append(createElement(documentRef, "li", { textContent: String(item) }));
    }
    field.append(
      createElement(documentRef, "span", { textContent: "验收标准" }),
      list,
    );
    body.append(field);
  }

  outputElement.append(header, chips, body);
}

export function renderUserInterface({
  root,
  documentRef = document,
  workflowApi = createWorkflowApiClient(),
  setTimeoutFn = globalThis.window?.setTimeout?.bind(globalThis.window),
  clearTimeoutFn = globalThis.window?.clearTimeout?.bind(globalThis.window),
  recommendationRefreshMs = 2000,
} = {}) {
  if (!root) return null;

  const shell = createElement(documentRef, "section", { className: "user-shell" });
  const draftPanel = createElement(documentRef, "aside", {
    className: "draft-panel",
    attributes: { "aria-labelledby": "userTaskDraftTitle" },
  });
  const timelineColumn = createElement(documentRef, "section", {
    className: "timeline-column",
    attributes: { "aria-labelledby": "userStageTimelineTitle" },
  });
  const workspace = createElement(documentRef, "section", {
    className: "user-workspace",
    attributes: { "aria-labelledby": "userWorkspaceTitle" },
  });

  const taskPoolPanel = createElement(documentRef, "section", {
    className: "task-pool-panel",
    attributes: { "aria-labelledby": "userTaskPoolTitle" },
  });
  const taskPoolHeader = createElement(documentRef, "div", { className: "task-pool-header" });
  taskPoolHeader.append(
    createElement(documentRef, "h2", { id: "userTaskPoolTitle", textContent: "任务池" }),
    createElement(documentRef, "span", {
      id: "userTaskPoolCount",
      className: "task-pool-count",
      textContent: "载入中",
    }),
  );
  const taskPoolList = createElement(documentRef, "div", {
    id: "userTaskPoolList",
    className: "task-pool-list",
  });
  taskPoolPanel.append(taskPoolHeader, taskPoolList);

  const recommendationPanel = createElement(documentRef, "section", {
    className: "recommendation-panel",
    attributes: { "aria-labelledby": "userRecommendationTitle" },
  });
  const recommendationHeader = createElement(documentRef, "div", { className: "recommendation-header" });
  const recommendationStatus = createElement(documentRef, "span", {
    id: "userRecommendationStatus",
    className: "task-pool-count",
    textContent: "未运行",
  });
  recommendationHeader.append(
    createElement(documentRef, "h2", { id: "userRecommendationTitle", textContent: "任务推荐器" }),
    recommendationStatus,
  );
  const recommendationSummary = createElement(documentRef, "p", {
    id: "userRecommendationSummary",
    className: "recommendation-summary-text",
    textContent: "等待从任务池中推荐一个可执行任务。",
  });
  const runRecommendationButton = createButton(documentRef, {
    id: "runUserRecommendationButton",
    className: "user-button secondary full-width",
    textContent: "运行推荐器",
  });
  const recommendationError = createElement(documentRef, "div", {
    className: "error-banner",
    attributes: { role: "alert" },
  });
  recommendationError.hidden = true;
  recommendationPanel.append(
    recommendationHeader,
    recommendationSummary,
    runRecommendationButton,
    recommendationError,
  );

  const draftHeader = createElement(documentRef, "div", { className: "draft-header" });
  const titleGroup = createElement(documentRef, "div", { className: "title-group" });
  titleGroup.append(
    createElement(documentRef, "p", { className: "eyebrow", textContent: "simple-workflow" }),
    createElement(documentRef, "h1", { id: "userTaskDraftTitle", textContent: "任务起草" }),
  );
  const taskDraftStatus = createElement(documentRef, "span", {
    id: "taskDraftStatus",
    className: "status-pill",
    textContent: "未开始",
  });
  draftHeader.append(titleGroup, taskDraftStatus);

  const taskDraftMessages = createElement(documentRef, "div", {
    id: "taskDraftMessages",
    className: "task-draft-messages",
    textContent: "还没有讨论记录。",
    attributes: { "aria-live": "polite" },
  });

  const taskDraftInput = createElement(documentRef, "textarea", {
    id: "taskDraftInput",
    className: "task-draft-input",
    attributes: {
      "aria-label": "任务起草讨论",
      placeholder: "描述任务目标、约束或验收标准",
      rows: "5",
    },
  });

  const draftActions = createElement(documentRef, "div", { className: "draft-actions" });
  const taskDraftDiscussButton = createButton(documentRef, {
    id: "taskDraftDiscussButton",
    className: "user-button secondary",
    textContent: "继续讨论",
  });
  const taskDraftFinalizeButton = createButton(documentRef, {
    id: "taskDraftFinalizeButton",
    className: "user-button primary",
    textContent: "生成任务",
  });
  draftActions.append(taskDraftDiscussButton, taskDraftFinalizeButton);

  const draftOutputHeader = createElement(documentRef, "div", { className: "draft-output-header" });
  draftOutputHeader.append(
    createElement(documentRef, "h2", { textContent: "任务文本" }),
    createElement(documentRef, "span", {
      id: "taskDraftValidation",
      className: "validation-text",
      textContent: "等待生成",
    }),
  );
  const taskDraftOutput = createElement(documentRef, "div", {
    id: "taskDraftOutput",
    className: "task-draft-output",
    textContent: "敲定后展示解析后的任务内容。",
  });
  const taskDraftCreateButton = createButton(documentRef, {
    id: "taskDraftCreateButton",
    className: "user-button secondary full-width",
    textContent: "加入任务池",
    disabled: true,
  });
  const taskDraftCommitButton = createButton(documentRef, {
    id: "taskDraftCommitButton",
    className: "user-button secondary full-width",
    textContent: "提交任务",
    disabled: true,
  });

  const errorBanner = createElement(documentRef, "div", {
    className: "error-banner",
    attributes: { role: "alert" },
  });
  errorBanner.hidden = true;

  const taskDraftPanel = createElement(documentRef, "section", {
    className: "task-draft-panel",
    attributes: { "aria-labelledby": "userTaskDraftTitle" },
  });
  taskDraftPanel.append(
    draftHeader,
    taskDraftMessages,
    taskDraftInput,
    draftActions,
    draftOutputHeader,
    taskDraftOutput,
    taskDraftCreateButton,
    taskDraftCommitButton,
    errorBanner,
  );

  draftPanel.append(taskPoolPanel, recommendationPanel, taskDraftPanel);

  const timelineHeader = createElement(documentRef, "div", { className: "timeline-header" });
  const timelineStatus = createElement(documentRef, "span", {
    id: "userStageTimelineStatus",
    className: "status-pill",
    textContent: "等待任务包",
  });
  timelineHeader.append(
    createElement(documentRef, "h2", { id: "userStageTimelineTitle", textContent: "状态转移链路" }),
    timelineStatus,
  );
  const timelinePanel = createElement(documentRef, "div", {
    id: "userStageTimelinePanel",
    className: "user-stage-timeline-panel",
  });
  timelinePanel.append(createElement(documentRef, "p", {
    className: "empty-state",
    textContent: "等待任务上下文包。",
  }));
  timelineColumn.append(timelineHeader, timelinePanel);

  workspace.append(
    createElement(documentRef, "h2", { id: "userWorkspaceTitle", textContent: "工作区" }),
  );

  shell.append(draftPanel, timelineColumn, workspace);
  root.replaceChildren(shell);

  let selectedPackageId = null;
  let latestPoolEntries = [];
  let latestTaskContextPackages = [];
  let selectedTimelineNodeIndex = null;
  let latestRecommendationRun = null;
  let latestCreatedTaskSource = null;
  let recommendationRefreshTimer = null;

  function clearRecommendationRefreshTimer() {
    if (!recommendationRefreshTimer || typeof clearTimeoutFn !== "function") return;
    clearTimeoutFn(recommendationRefreshTimer);
    recommendationRefreshTimer = null;
  }

  function scheduleRecommendationRefresh() {
    if (latestRecommendationRun?.status !== "running") {
      clearRecommendationRefreshTimer();
      return;
    }
    if (recommendationRefreshTimer || typeof setTimeoutFn !== "function") return;
    recommendationRefreshTimer = setTimeoutFn(() => {
      recommendationRefreshTimer = null;
      Promise.all([
        refreshTaskPool(),
        refreshRecommendationRun(),
      ]).catch(showRecommendationError);
    }, recommendationRefreshMs);
  }

  function selectedTaskContextPackage() {
    return latestTaskContextPackages.find((taskPackage) =>
      taskPackage.packageId === selectedPackageId);
  }

  function selectTimelineNode(index) {
    selectedTimelineNodeIndex = index;
    renderStageTimeline({
      documentRef,
      timelinePanel,
      timelineStatus,
      taskContextPackage: selectedTaskContextPackage(),
      selectedNodeIndex: selectedTimelineNodeIndex,
      onSelectNode: selectTimelineNode,
    });
  }

  function selectPackage(packageId) {
    selectedPackageId = packageId;
    selectedTimelineNodeIndex = null;
    renderTaskPoolList({
      documentRef,
      listElement: taskPoolList,
      countElement: taskPoolHeader.querySelector?.("#userTaskPoolCount")
        ?? taskPoolHeader.children?.[1],
      entries: latestPoolEntries,
      selectedPackageId,
      onSelectPackage: selectPackage,
    });
    renderStageTimeline({
      documentRef,
      timelinePanel,
      timelineStatus,
      taskContextPackage: selectedTaskContextPackage(),
      selectedNodeIndex: selectedTimelineNodeIndex,
      onSelectNode: selectTimelineNode,
    });
  }

  const elements = {
    taskDraftStatus,
    taskDraftMessages,
    taskDraftInput,
    taskDraftDiscussButton,
    taskDraftFinalizeButton,
    taskDraftCreateButton,
    taskDraftCommitButton,
    taskDraftValidation: draftOutputHeader.querySelector?.("#taskDraftValidation")
      ?? draftOutputHeader.children?.[1],
    taskDraftOutput,
  };
  function showError(error) {
    errorBanner.hidden = false;
    errorBanner.textContent = error?.message ?? "操作失败";
  }

  function showRecommendationError(error) {
    recommendationError.hidden = false;
    recommendationError.textContent = error?.message ?? "推荐器运行失败";
  }

  async function refreshRecommendationRun() {
    if (typeof workflowApi.loadRecommendationRun !== "function") return;
    try {
      const payload = await workflowApi.loadRecommendationRun();
      latestRecommendationRun = payload.recommendationRun ?? null;
      renderRecommendationPanel({
        recommendationRun: latestRecommendationRun,
        runButton: runRecommendationButton,
        statusElement: recommendationStatus,
        summaryElement: recommendationSummary,
      });
      scheduleRecommendationRefresh();
    } catch (error) {
      recommendationStatus.textContent = "读取失败";
      recommendationSummary.textContent = error?.message ?? "读取推荐器失败";
      clearRecommendationRefreshTimer();
    }
  }

  async function refreshTaskPool() {
    if (typeof workflowApi.loadWorkflowSnapshot !== "function") return;
    try {
      const snapshot = await workflowApi.loadWorkflowSnapshot();
      latestPoolEntries = snapshot.taskPool?.entries ?? [];
      latestTaskContextPackages = snapshot.taskPool?.taskContextPackages ?? [];
      selectedPackageId = selectInitialPackageId({
        previousPackageId: selectedPackageId,
        entries: latestPoolEntries,
        packages: latestTaskContextPackages,
      });
      selectedTimelineNodeIndex = null;
      renderTaskPoolList({
        documentRef,
        listElement: taskPoolList,
        countElement: taskPoolHeader.querySelector?.("#userTaskPoolCount")
          ?? taskPoolHeader.children?.[1],
        entries: latestPoolEntries,
        selectedPackageId,
        onSelectPackage: selectPackage,
      });
      renderStageTimeline({
        documentRef,
        timelinePanel,
        timelineStatus,
        taskContextPackage: selectedTaskContextPackage(),
        selectedNodeIndex: selectedTimelineNodeIndex,
        onSelectNode: selectTimelineNode,
      });
    } catch (error) {
      const taskPoolCount = taskPoolHeader.querySelector?.("#userTaskPoolCount")
        ?? taskPoolHeader.children?.[1];
      taskPoolCount.textContent = "读取失败";
      taskPoolList.replaceChildren(createElement(documentRef, "p", {
        className: "empty-state error-text",
        textContent: error?.message ?? "读取任务池失败",
      }));
      renderStageTimeline({
        documentRef,
        timelinePanel,
        timelineStatus,
        taskContextPackage: null,
        selectedNodeIndex: null,
        onSelectNode: selectTimelineNode,
      });
    }
  }

  const commands = createWorkflowPageTaskDraftAssistantCommands({
    workflowApi,
    elements,
    refreshPage: refreshTaskPool,
    renderTaskDraftOutput: ({ outputElement, taskDraft }) => renderParsedTaskDraftOutput({
      documentRef,
      outputElement,
      taskDraft,
    }),
  });

  function runAction(action) {
    errorBanner.hidden = true;
    errorBanner.textContent = "";
    action().catch(showError);
  }

  function runRecommendationAction(action) {
    recommendationError.hidden = true;
    recommendationError.textContent = "";
    action().catch(showRecommendationError);
  }

  taskDraftDiscussButton.addEventListener("click", () => {
    runAction(() => commands.sendTaskDraftMessage());
  });
  taskDraftFinalizeButton.addEventListener("click", () => {
    runAction(() => commands.finalizeTaskDraft());
  });
  taskDraftCreateButton.addEventListener("click", () => {
    runAction(async () => {
      const result = await commands.createTaskSourceFromDraft();
      if (result.ok) {
        latestCreatedTaskSource = result.taskSource;
        taskDraftCommitButton.disabled = false;
      }
      return result;
    });
  });
  taskDraftCommitButton.addEventListener("click", () => {
    runAction(async () => {
      if (!latestCreatedTaskSource?.fileName) return { ok: false, skipped: true };
      const originalText = taskDraftCommitButton.textContent;
      taskDraftCommitButton.disabled = true;
      taskDraftCommitButton.textContent = "提交中";
      try {
        const payload = await workflowApi.commitTaskSourceFromDraft({
          fileName: latestCreatedTaskSource.fileName,
        });
        taskDraftStatus.textContent = `已提交 ${payload.commit.commitSha.slice(0, 7)}`;
        taskDraftCommitButton.textContent = "已提交";
        await refreshTaskPool();
        await refreshRecommendationRun();
        return { ok: true, commit: payload.commit };
      } catch (error) {
        taskDraftCommitButton.textContent = originalText;
        taskDraftCommitButton.disabled = false;
        throw error;
      }
    });
  });
  taskDraftInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    runAction(() => commands.sendTaskDraftMessage());
  });
  runRecommendationButton.addEventListener("click", () => {
    runRecommendationAction(async () => {
      runRecommendationButton.disabled = true;
      recommendationStatus.textContent = "启动中";
      recommendationSummary.textContent = "推荐器正在启动。";
      const payload = await workflowApi.startRecommendationRun({ mode: "probe" });
      latestRecommendationRun = payload.recommendationRun ?? null;
      renderRecommendationPanel({
        recommendationRun: latestRecommendationRun,
        runButton: runRecommendationButton,
        statusElement: recommendationStatus,
        summaryElement: recommendationSummary,
      });
      await Promise.all([
        refreshTaskPool(),
        refreshRecommendationRun(),
      ]);
    });
  });

  refreshTaskPool();
  refreshRecommendationRun();

  return {
    commands,
    elements: {
      ...elements,
      taskPoolList,
      taskPoolPanel,
      recommendationPanel,
      recommendationStatus,
      recommendationSummary,
      runRecommendationButton,
      taskDraftCommitButton,
      timelinePanel,
      timelineStatus,
    },
    refreshTaskPool,
    refreshRecommendationRun,
  };
}

if (typeof document !== "undefined") {
  renderUserInterface({
    root: document.querySelector("#userApp"),
  });
}
