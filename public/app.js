const taskList = document.querySelector("#taskList");
const taskCount = document.querySelector("#taskCount");
const taskPool = document.querySelector("#taskPool");
const poolCount = document.querySelector("#poolCount");
const startupCheckPanel = document.querySelector("#startupCheckPanel");
const startupCheckStatus = document.querySelector("#startupCheckStatus");
const selectedTitle = document.querySelector("#selectedTitle");
const selectedMeta = document.querySelector("#selectedMeta");
const rawText = document.querySelector("#rawText");
const parsedText = document.querySelector("#parsedText");
const parseStatus = document.querySelector("#parseStatus");
const validationResult = document.querySelector("#validationResult");
const validationStatus = document.querySelector("#validationStatus");
const restartButton = document.querySelector("#restartButton");
const refreshButton = document.querySelector("#refreshButton");
const recommendationStatus = document.querySelector("#recommendationStatus");
const recommendationResult = document.querySelector("#recommendationResult");
const runRecommendationButton = document.querySelector("#runRecommendationButton");
const cancelRecommendationButton = document.querySelector("#cancelRecommendationButton");
const taskPoolRaw = document.querySelector("#taskPoolRaw");
const startupCheckRaw = document.querySelector("#startupCheckRaw");
const recommendationRaw = document.querySelector("#recommendationRaw");
const recommendationTerminal = document.querySelector("#recommendationTerminal");
const recommendationIntentPanel = document.querySelector("#recommendationIntentPanel");
const admissionStatus = document.querySelector("#admissionStatus");
const admissionRaw = document.querySelector("#admissionRaw");
const admissionPanel = document.querySelector("#admissionPanel");
const taskContextPackageRaw = document.querySelector("#taskContextPackageRaw");
const taskContextPackagePanel = document.querySelector("#taskContextPackagePanel");
const taskContextPackageStatus = document.querySelector("#taskContextPackageStatus");
const taskSourceInputs = document.querySelector("#taskSourceInputs");
const taskPoolInputs = document.querySelector("#taskPoolInputs");
const startupCheckInputs = document.querySelector("#startupCheckInputs");
const recommendationInputs = document.querySelector("#recommendationInputs");
const admissionInputs = document.querySelector("#admissionInputs");
const humanDecisionStatus = document.querySelector("#humanDecisionStatus");
const humanDecisionInputs = document.querySelector("#humanDecisionInputs");
const humanDecisionRaw = document.querySelector("#humanDecisionRaw");
const humanDecisionPanel = document.querySelector("#humanDecisionPanel");
const autoMergeStatus = document.querySelector("#autoMergeStatus");
const autoMergeInputs = document.querySelector("#autoMergeInputs");
const autoMergeRaw = document.querySelector("#autoMergeRaw");
const autoMergePanel = document.querySelector("#autoMergePanel");
const autoMergeExecutionStatus = document.querySelector("#autoMergeExecutionStatus");
const autoMergeExecutionInputs = document.querySelector("#autoMergeExecutionInputs");
const autoMergeExecutionRaw = document.querySelector("#autoMergeExecutionRaw");
const autoMergeExecutionPanel = document.querySelector("#autoMergeExecutionPanel");
const taskCloseoutStatus = document.querySelector("#taskCloseoutStatus");
const taskCloseoutInputs = document.querySelector("#taskCloseoutInputs");
const taskCloseoutRaw = document.querySelector("#taskCloseoutRaw");
const taskCloseoutPanel = document.querySelector("#taskCloseoutPanel");

let tasks = [];
let poolEntries = [];
let poolTaskContextPackages = [];
let startupCheck = null;
let recommendationRun = null;
let selectedFileName = null;
let latestRecommendationSyncAt = 0;

function stripAnsi(text) {
  return String(text ?? "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function formatProgress(progress) {
  return (progress ?? [])
    .map((entry) => {
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--:--:--";
      return `${time} ${entry.message}`;
    })
    .join("\n");
}

function formatTerminalProgress(run) {
  if (!run) return "尚未启动进程。";
  const lines = [
    `run: ${run.id ?? "unknown"}`,
    `status: ${run.status ?? "unknown"} · elapsed: ${formatElapsed(run.startedAt, run.finishedAt)}`,
    `command: ${run.command ? [run.command, ...(run.args ?? [])].join(" ") : "未启动外部命令"}`,
    "",
  ];
  const progress = run.progress ?? [];
  if (progress.length === 0) {
    lines.push(run.status === "running"
      ? "process: 已请求启动，等待首个终端事件..."
      : "process: 无终端事件。");
  }
  for (const entry of progress) {
    const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--:--:--";
    const stream = entry.stream ?? entry.type ?? "event";
    const terminalLine = stripAnsi(entry.terminalLine ?? entry.message ?? "");
    lines.push(`[${time}] [${stream}] ${terminalLine}`);
  }
  if (run.status === "running" && progress.length > 0) {
    lines.push("");
    lines.push("process: running, waiting for next output...");
  }
  return lines.join("\n");
}

function formatElapsed(startedAt, finishedAt = null) {
  if (!startedAt) return "--:--";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "--:--";
  const totalSeconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function createIntentPanel(intent) {
  const panel = document.createElement("div");
  panel.className = "recommendation-intent";

  const title = document.createElement("div");
  title.className = "recommendation-intent-title";
  title.textContent = intent.recommendedPackageId;

  const meta = document.createElement("div");
  meta.className = "recommendation-intent-meta";
  meta.textContent = `推荐置信度：${intent.confidence}`;

  const goal = document.createElement("div");
  goal.className = "recommendation-intent-next";
  goal.textContent = intent.executionBrief?.goalInterpretation ?? "";

  panel.append(title, meta, goal);

  if (intent.selectionReasoning?.length > 0) {
    const list = document.createElement("ul");
    list.className = "recommendation-intent-list";
    for (const reason of intent.selectionReasoning) {
      const item = document.createElement("li");
      item.textContent = reason;
      list.append(item);
    }
    panel.append(list);
  }

  if (intent.candidateComparison?.length > 0) {
    const observed = document.createElement("div");
    observed.className = "recommendation-observed";
    observed.textContent = `candidateComparison: ${intent.candidateComparison
      .map((item) => `${item.packageId}:${item.decision}`)
      .join(", ")}`;
    panel.append(observed);
  }

  return panel;
}

function createAdmissionPanel(admission) {
  const panel = document.createElement("div");
  const appendRequest = admission.appendRequest;
  const artifactType = appendRequest?.artifactType ?? "unknown";
  panel.className = `admission-panel ${artifactType}`;

  const title = document.createElement("div");
  title.className = "admission-title";
  title.textContent =
    artifactType === "executionAuthorization"
      ? `已授权执行：${appendRequest.packageId}`
      : `未授权执行：${appendRequest?.packageId ?? "无任务"}`;

  const meta = document.createElement("div");
  meta.className = "admission-meta";
  meta.textContent = `artifactType: ${artifactType}`;

  panel.append(title, meta);

  const findings = appendRequest?.artifact?.findings ?? [];
  if (findings.length > 0) {
    const list = document.createElement("ul");
    list.className = "admission-reasons";
    for (const finding of findings) {
      const item = document.createElement("li");
      item.textContent = `${finding.code}: ${finding.message}`;
      list.append(item);
    }
    panel.append(list);
  }

  return panel;
}

function artifactRecords(artifactValue) {
  if (Array.isArray(artifactValue)) return artifactValue;
  return artifactValue ? [artifactValue] : [];
}

function activeTaskContextPackage() {
  const selectedPackage = poolTaskContextPackages.find((taskPackage) =>
    taskPackage.source?.path === `tasks/${selectedFileName}`,
  );
  if (selectedPackage) return selectedPackage;
  if (recommendationRun?.taskContextPackage) return recommendationRun.taskContextPackage;
  return poolTaskContextPackages.find((taskPackage) =>
    taskPackage.currentWorkStage === "human-decision"
      && taskPackage.artifacts?.humanDecisionRequest?.body
      && !taskPackage.artifacts?.humanDecision?.body,
  ) ?? null;
}

function taskContextPackageLabel(taskContextPackage) {
  if (!taskContextPackage) return "等待输入";
  const sourceFile = taskContextPackage.source?.path?.split("/").pop() ?? taskContextPackage.packageId;
  return `${sourceFile} · ${taskContextPackage.currentWorkStage}`;
}

function createHumanDecisionPanel(taskContextPackage) {
  const request = taskContextPackage?.artifacts?.humanDecisionRequest;
  const decision = taskContextPackage?.artifacts?.humanDecision;
  if (!request?.body && !decision?.body) return null;

  const notice = document.createElement("div");
  notice.className = "human-decision-notice";

  const title = document.createElement("div");
  title.className = "human-decision-title";
  title.textContent = decision?.body
    ? "已接受完成"
    : "等待人工决策";

  const reason = document.createElement("div");
  reason.className = "human-decision-reason";
  reason.textContent = decision?.body
    ? "任务完成结论已由人工接受，等待自动合并环节处理。"
    : request.body.reason ?? "需要人工确认下一步。";

  const meta = document.createElement("div");
  meta.className = "human-decision-meta";
  meta.textContent = decision?.body
    ? [
        `decision: ${decision.body.decision}`,
        `next: ${decision.body.nextRequiredStage}`,
        `decidedAt: ${decision.body.decidedAt ?? decision.appendedAt ?? "unknown"}`,
      ].join(" · ")
    : [
        `target: ${request.body.taskCompletionRef ?? "unknown"}`,
        `requestedAt: ${request.body.requestedAt ?? request.appendedAt ?? "unknown"}`,
      ].join(" · ");

  notice.append(title, reason, meta);

  if (decision?.body?.worktreeSnapshot?.changedFiles?.length > 0) {
    const options = document.createElement("div");
    options.className = "human-decision-options";
    for (const filePath of decision.body.worktreeSnapshot.changedFiles) {
      const badge = document.createElement("span");
      badge.textContent = filePath;
      options.append(badge);
    }
    notice.append(options);
  } else if (request.body.decisionOptions?.length > 0) {
    const options = document.createElement("div");
    options.className = "human-decision-options";
    for (const option of request.body.decisionOptions) {
      const badge = document.createElement("span");
      badge.textContent = option;
      options.append(badge);
    }
    notice.append(options);
  }

  if (request?.body && !decision?.body) {
    const acceptButton = document.createElement("button");
    acceptButton.type = "button";
    acceptButton.className = "primary-button human-decision-action";
    acceptButton.textContent = "接受完成";
    acceptButton.addEventListener("click", () => {
      acceptCompletion().catch(showError);
    });
    notice.append(acceptButton);
  }

  return notice;
}

function createAutoMergePanel(taskContextPackage) {
  const plan = taskContextPackage?.artifacts?.autoMergePlan;
  const rejection = taskContextPackage?.artifacts?.autoMergeRejection;
  const record = plan ?? rejection;
  if (!record?.body) return null;

  const panel = document.createElement("div");
  panel.className = `auto-merge-panel ${plan ? "autoMergePlan" : "autoMergeRejection"}`;

  const title = document.createElement("div");
  title.className = "auto-merge-title";
  title.textContent = plan ? "已生成自动合并计划" : "自动合并前置校验未通过";

  const meta = document.createElement("div");
  meta.className = "auto-merge-meta";
  meta.textContent = plan
    ? [
        `target: ${record.body.target?.branchName ?? "unknown"}`,
        `changes: ${record.body.changeSet?.changedFiles?.length ?? 0}`,
        `plannedAt: ${record.body.plannedAt ?? record.appendedAt ?? "unknown"}`,
      ].join(" · ")
    : [
        `decisionRef: ${record.body.decisionRef ?? "unknown"}`,
        `rejectedAt: ${record.body.rejectedAt ?? record.appendedAt ?? "unknown"}`,
      ].join(" · ");

  panel.append(title, meta);

  const changedFiles = plan ? record.body.changeSet?.changedFiles ?? [] : [];
  if (changedFiles.length > 0) {
    const list = document.createElement("ul");
    list.className = "auto-merge-list";
    for (const filePath of changedFiles) {
      const item = document.createElement("li");
      item.textContent = filePath;
      list.append(item);
    }
    panel.append(list);
  }

  const reasons = rejection ? record.body.reasons ?? [] : [];
  if (reasons.length > 0) {
    const list = document.createElement("ul");
    list.className = "auto-merge-list";
    for (const itemReason of reasons) {
      const item = document.createElement("li");
      item.textContent = `${itemReason.code}: ${itemReason.message}`;
      list.append(item);
    }
    panel.append(list);
  }

  return panel;
}

function createAutoMergeExecutionPanel(taskContextPackage) {
  const result = taskContextPackage?.artifacts?.autoMergeResult;
  const failure = taskContextPackage?.artifacts?.autoMergeFailure;
  const record = result ?? failure;
  if (!record?.body) return null;

  const panel = document.createElement("div");
  panel.className = `auto-merge-panel ${result ? "autoMergeResult" : "autoMergeFailure"}`;

  const title = document.createElement("div");
  title.className = "auto-merge-title";
  title.textContent = result ? "已合入目标分支" : "自动合并执行失败";

  const meta = document.createElement("div");
  meta.className = "auto-merge-meta";
  meta.textContent = result
    ? [
        `target: ${record.body.target?.branchName ?? "unknown"}`,
        `after: ${record.body.target?.afterCommit?.slice(0, 7) ?? "unknown"}`,
        `mergedAt: ${record.body.mergedAt ?? record.appendedAt ?? "unknown"}`,
      ].join(" · ")
    : [
        `planRef: ${record.body.planRef ?? "unknown"}`,
        `failedAt: ${record.body.failedAt ?? record.appendedAt ?? "unknown"}`,
      ].join(" · ");

  panel.append(title, meta);

  const changedFiles = result ? record.body.changeSet?.changedFiles ?? [] : [];
  if (changedFiles.length > 0) {
    const list = document.createElement("ul");
    list.className = "auto-merge-list";
    for (const filePath of changedFiles) {
      const item = document.createElement("li");
      item.textContent = filePath;
      list.append(item);
    }
    panel.append(list);
  }

  const reasons = failure ? record.body.reasons ?? [] : [];
  if (reasons.length > 0) {
    const list = document.createElement("ul");
    list.className = "auto-merge-list";
    for (const itemReason of reasons) {
      const item = document.createElement("li");
      item.textContent = `${itemReason.code}: ${itemReason.message}`;
      list.append(item);
    }
    panel.append(list);
  }

  if (failure && taskContextPackage?.currentWorkStage === "auto-merge-execution" && !result) {
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "primary-button human-decision-action";
    retryButton.textContent = "重试自动合并";
    retryButton.addEventListener("click", () => {
      retryAutoMerge().catch(showError);
    });
    panel.append(retryButton);
  }

  return panel;
}

function createTaskCloseoutPanel(taskContextPackage) {
  const closeout = taskContextPackage?.artifacts?.taskCloseout;
  if (!closeout?.body) return null;

  const panel = document.createElement("div");
  panel.className = "auto-merge-panel taskCloseout";

  const title = document.createElement("div");
  title.className = "auto-merge-title";
  title.textContent = "任务已收尾";

  const meta = document.createElement("div");
  meta.className = "auto-merge-meta";
  meta.textContent = [
    `finalStage: ${closeout.body.finalStage ?? "unknown"}`,
    `closedAt: ${closeout.body.closedAt ?? closeout.appendedAt ?? "unknown"}`,
  ].join(" · ");

  panel.append(title, meta);

  const cleanup = closeout.body.cleanup ?? {};
  const list = document.createElement("ul");
  list.className = "auto-merge-list";
  for (const text of [
    `worktree: ${cleanup.worktree?.path ?? "unknown"} · removed: ${String(cleanup.worktree?.removed ?? false)}`,
    `branch: ${cleanup.branch?.name ?? "unknown"} · deleted: ${String(cleanup.branch?.deleted ?? false)}`,
  ]) {
    const item = document.createElement("li");
    item.textContent = text;
    list.append(item);
  }
  panel.append(list);

  return panel;
}

function createTaskContextPackagePanel(taskContextPackage) {
  const panel = document.createElement("div");
  panel.className = `context-package ${taskContextPackage.currentWorkStage}`;

  const title = document.createElement("div");
  title.className = "context-package-title";
  title.textContent = `${taskContextPackage.packageId}`;

  const meta = document.createElement("div");
  meta.className = "context-package-meta";
  meta.textContent = [
    `currentWorkStage: ${taskContextPackage.currentWorkStage}`,
    `source: ${taskContextPackage.source?.path ?? "unknown"}`,
  ].join(" · ");

  panel.append(title, meta);

  const artifacts = document.createElement("div");
  artifacts.className = "context-package-artifacts";
  artifacts.innerHTML = `
    <span>基础包</span><strong></strong>
    <span>执行意图</span><strong></strong>
    <span>执行授权</span><strong></strong>
    <span>隔离工作树</span><strong></strong>
    <span>任务完成结论</span><strong></strong>
    <span>人工决策</span><strong></strong>
    <span>自动合并计划</span><strong></strong>
    <span>自动合并执行</span><strong></strong>
    <span>任务收尾</span><strong></strong>
  `;
  const values = artifacts.querySelectorAll("strong");
  values[0].textContent = taskContextPackage.qualityGate?.outcome ?? "missing";
  values[1].textContent = taskContextPackage.artifacts?.executionIntent ? "已追加" : "未追加";
  values[2].textContent = taskContextPackage.artifacts?.executionAuthorization
    ? "已追加"
    : taskContextPackage.artifacts?.admissionRejection
      ? "未授权"
      : "未追加";
  values[3].textContent = taskContextPackage.artifacts?.isolatedWorkspace ? "已分配" : "未分配";
  values[4].textContent = taskContextPackage.artifacts?.taskCompletion ? "待确认" : "未生成";
  values[5].textContent = taskContextPackage.artifacts?.humanDecision
    ? "已接受完成"
    : taskContextPackage.artifacts?.humanDecisionRequest
      ? "等待人工决策"
      : "未请求";
  values[6].textContent = taskContextPackage.artifacts?.autoMergePlan
    ? "已生成"
    : taskContextPackage.artifacts?.autoMergeRejection
      ? "未通过"
      : "未检查";
  values[7].textContent = taskContextPackage.artifacts?.autoMergeResult
    ? "已合并"
    : taskContextPackage.artifacts?.autoMergeFailure
      ? "失败"
      : "未执行";
  values[8].textContent = taskContextPackage.artifacts?.taskCloseout
    ? "已关闭"
    : "未收尾";
  panel.append(artifacts);

  const artifactEntries = Object.entries(taskContextPackage.artifacts ?? {});
  if (artifactEntries.length > 0) {
    const list = document.createElement("ul");
    list.className = "context-package-records";
    for (const [artifactType, artifactValue] of artifactEntries) {
      for (const artifact of artifactRecords(artifactValue)) {
        const body = artifact.body ?? {};
        const item = document.createElement("li");
        item.innerHTML = "<strong></strong><span></span><em></em>";
        item.querySelector("strong").textContent = artifact.artifactId ?? artifactType;
        item.querySelector("span").textContent = body.authorizedAt ?? body.rejectedAt ?? body.requestedAt ?? artifact.appendedAt ?? "已追加";
        item.querySelector("em").textContent = body.reason ?? body.executionBrief?.goalInterpretation ?? body.summary ?? "";
        list.append(item);
      }
    }
    panel.append(list);
  }

  if (taskContextPackage.agentRuns?.length > 0) {
    const title = document.createElement("div");
    title.className = "context-package-section-title";
    title.textContent = "Agent 调用";

    const list = document.createElement("ul");
    list.className = "context-package-records";
    for (const agentRun of taskContextPackage.agentRuns) {
      const item = document.createElement("li");
      item.innerHTML = "<strong></strong><span></span><em></em>";
      item.querySelector("strong").textContent = agentRun.runId;
      item.querySelector("span").textContent = `${agentRun.role} · ${agentRun.status}`;
      item.querySelector("em").textContent = agentRun.sessionId;
      list.append(item);
    }

    panel.append(title, list);
  }

  return panel;
}

function formatJsonBlock(value) {
  return value ? JSON.stringify(value, null, 2) : "未生成。";
}

function renderHumanDecision(taskContextPackage) {
  humanDecisionPanel.replaceChildren();
  const request = taskContextPackage?.artifacts?.humanDecisionRequest ?? null;
  const decision = taskContextPackage?.artifacts?.humanDecision ?? null;
  const taskCompletion = taskContextPackage?.artifacts?.taskCompletion ?? null;
  humanDecisionRaw.textContent = formatJsonBlock({
    taskCompletion,
    humanDecisionRequest: request,
    humanDecision: decision,
  });
  renderInputs(humanDecisionInputs, [
    { label: "任务完成结论", value: taskCompletion?.artifactId ?? "未生成" },
    { label: "人工决策请求", value: request?.artifactId ?? "未请求" },
    { label: "人工决策", value: decision?.body?.decision ?? "未决策" },
    { label: "当前环节", value: taskContextPackage?.currentWorkStage ?? "未生成" },
  ]);

  if (decision) {
    humanDecisionStatus.textContent = "已接受完成";
    const panel = createHumanDecisionPanel(taskContextPackage);
    humanDecisionPanel.append(panel);
    return;
  }

  if (!request) {
    humanDecisionStatus.textContent = taskCompletion ? "未请求" : "等待完成";
    humanDecisionPanel.textContent = taskCompletion
      ? "已生成任务完成结论，但尚未请求人工决策。"
      : "等待任务完成结论。";
    return;
  }

  humanDecisionStatus.textContent = "等待人工决策";
  const panel = createHumanDecisionPanel(taskContextPackage);
  humanDecisionPanel.append(panel);
}

function renderAutoMerge(taskContextPackage) {
  autoMergePanel.replaceChildren();
  const humanDecision = taskContextPackage?.artifacts?.humanDecision ?? null;
  const plan = taskContextPackage?.artifacts?.autoMergePlan ?? null;
  const rejection = taskContextPackage?.artifacts?.autoMergeRejection ?? null;
  autoMergeRaw.textContent = formatJsonBlock({
    humanDecision,
    autoMergePlan: plan,
    autoMergeRejection: rejection,
  });
  renderInputs(autoMergeInputs, [
    { label: "人工决策", value: humanDecision?.body?.decision ?? "未接受" },
    { label: "当前环节", value: taskContextPackage?.currentWorkStage ?? "未生成" },
    { label: "合并计划", value: plan?.artifactId ?? "未生成" },
    { label: "拒绝记录", value: rejection?.artifactId ?? "未生成" },
  ]);

  if (plan) {
    autoMergeStatus.textContent = "可执行合并";
    const panel = createAutoMergePanel(taskContextPackage);
    autoMergePanel.append(panel);
    return;
  }

  if (rejection) {
    autoMergeStatus.textContent = "未通过";
    const panel = createAutoMergePanel(taskContextPackage);
    autoMergePanel.append(panel);
    return;
  }

  if (taskContextPackage?.currentWorkStage === "auto-merge") {
    autoMergeStatus.textContent = "自动检查中";
    autoMergePanel.textContent = "人工已接受完成，系统正在生成自动合并计划。";
    return;
  }

  autoMergeStatus.textContent = humanDecision ? "等待自动合并" : "等待输入";
  autoMergePanel.textContent = humanDecision
    ? "等待任务进入 auto-merge 环节。"
    : "等待人工接受完成。";
}

function renderAutoMergeExecution(taskContextPackage) {
  autoMergeExecutionPanel.replaceChildren();
  const plan = taskContextPackage?.artifacts?.autoMergePlan ?? null;
  const result = taskContextPackage?.artifacts?.autoMergeResult ?? null;
  const failure = taskContextPackage?.artifacts?.autoMergeFailure ?? null;
  autoMergeExecutionRaw.textContent = formatJsonBlock({
    autoMergePlan: plan,
    autoMergeResult: result,
    autoMergeFailure: failure,
  });
  renderInputs(autoMergeExecutionInputs, [
    { label: "合并计划", value: plan?.artifactId ?? "未生成" },
    { label: "当前环节", value: taskContextPackage?.currentWorkStage ?? "未生成" },
    { label: "执行结果", value: result?.artifactId ?? "未生成" },
    { label: "失败记录", value: failure?.artifactId ?? "未生成" },
  ]);

  if (result) {
    autoMergeExecutionStatus.textContent = "已合并";
    const panel = createAutoMergeExecutionPanel(taskContextPackage);
    autoMergeExecutionPanel.append(panel);
    return;
  }

  if (failure) {
    autoMergeExecutionStatus.textContent = "失败";
    const panel = createAutoMergeExecutionPanel(taskContextPackage);
    autoMergeExecutionPanel.append(panel);
    return;
  }

  if (taskContextPackage?.currentWorkStage === "auto-merge-execution") {
    autoMergeExecutionStatus.textContent = "执行中";
    autoMergeExecutionPanel.textContent = "自动合并计划已生成，系统正在执行合并。";
    return;
  }

  autoMergeExecutionStatus.textContent = plan ? "等待执行" : "等待输入";
  autoMergeExecutionPanel.textContent = plan
    ? "等待任务进入 auto-merge-execution 环节。"
    : "等待自动合并计划。";
}

function renderTaskCloseout(taskContextPackage) {
  taskCloseoutPanel.replaceChildren();
  const autoMergeResult = taskContextPackage?.artifacts?.autoMergeResult ?? null;
  const closeout = taskContextPackage?.artifacts?.taskCloseout ?? null;
  taskCloseoutRaw.textContent = formatJsonBlock({
    autoMergeResult,
    taskCloseout: closeout,
  });
  renderInputs(taskCloseoutInputs, [
    { label: "自动合并结果", value: autoMergeResult?.artifactId ?? "未生成" },
    { label: "当前环节", value: taskContextPackage?.currentWorkStage ?? "未生成" },
    { label: "收尾产物", value: closeout?.artifactId ?? "未生成" },
  ]);

  if (closeout) {
    taskCloseoutStatus.textContent = "已关闭";
    const panel = createTaskCloseoutPanel(taskContextPackage);
    taskCloseoutPanel.append(panel);
    return;
  }

  if (taskContextPackage?.currentWorkStage === "merged") {
    taskCloseoutStatus.textContent = "收尾中";
    taskCloseoutPanel.textContent = "自动合并已完成，系统正在清理隔离工作树和任务分支。";
    return;
  }

  taskCloseoutStatus.textContent = autoMergeResult ? "等待收尾" : "等待输入";
  taskCloseoutPanel.textContent = autoMergeResult
    ? "等待任务进入 merged 环节。"
    : "等待自动合并结果。";
}

async function acceptCompletion() {
  const taskContextPackage = activeTaskContextPackage();
  humanDecisionStatus.textContent = "提交中";
  const response = await fetch("/api/human-decisions/accept-completion", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      packageId: taskContextPackage?.packageId ?? null,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `接受完成失败：${response.status}`);
  }
  recommendationRun = payload.recommendationRun ?? null;
  if (recommendationRun?.taskContextPackage) {
    const index = poolTaskContextPackages.findIndex((candidate) =>
      candidate.packageId === recommendationRun.taskContextPackage.packageId,
    );
    if (index >= 0) {
      poolTaskContextPackages[index] = recommendationRun.taskContextPackage;
    }
  }
  renderRecommendationRun();
  await loadTasks();
}

async function retryAutoMerge() {
  const taskContextPackage = activeTaskContextPackage();
  autoMergeExecutionStatus.textContent = "重试中";
  const response = await fetch("/api/auto-merge/retry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      packageId: taskContextPackage?.packageId ?? null,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `重试自动合并失败：${response.status}`);
  }
  recommendationRun = payload.recommendationRun ?? null;
  if (recommendationRun?.taskContextPackage) {
    const index = poolTaskContextPackages.findIndex((candidate) =>
      candidate.packageId === recommendationRun.taskContextPackage.packageId,
    );
    if (index >= 0) {
      poolTaskContextPackages[index] = recommendationRun.taskContextPackage;
    }
  }
  renderRecommendationRun();
  await loadTasks();
}

function renderInputs(container, inputs) {
  container.replaceChildren();
  const list = document.createElement("ul");
  list.className = "stage-input-list";
  for (const input of inputs) {
    const item = document.createElement("li");
    item.innerHTML = "<strong></strong><span></span>";
    item.querySelector("strong").textContent = input.label;
    item.querySelector("span").textContent = input.value;
    list.append(item);
  }
  container.append(list);
}

function renderList() {
  taskCount.textContent = `${tasks.length} 个文件`;
  taskList.replaceChildren();
  renderInputs(taskSourceInputs, [
    { label: "目录", value: "tasks/" },
    { label: "文件类型", value: ".yaml, .yml" },
    { label: "当前选择", value: selectedFileName ?? "未选择" },
    { label: "文件数量", value: `${tasks.length}` },
  ]);

  if (tasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "tasks/ 目录下还没有 .yaml 或 .yml 文件。";
    taskList.append(empty);
    return;
  }

  for (const task of tasks) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `task-item${task.fileName === selectedFileName ? " active" : ""}`;
    button.innerHTML = `
      <span class="task-file"></span>
      <span class="task-format"></span>
    `;
    button.querySelector(".task-file").textContent = task.fileName;
    button.querySelector(".task-format").textContent = task.format;
    button.addEventListener("click", () => selectTask(task.fileName));
    taskList.append(button);
  }
}

function renderTaskPool() {
  poolCount.textContent = `${poolEntries.length} 个条目`;
  taskPool.replaceChildren();
  taskPoolRaw.textContent = JSON.stringify(poolEntries, null, 2);
  renderInputs(taskPoolInputs, [
    { label: "输入", value: "任务真源解析结果" },
    { label: "任务文件", value: tasks.map((task) => task.fileName).join(", ") || "无" },
    { label: "过滤规则", value: "只接收 parseError 为空且有 parsed 的任务" },
  ]);

  if (poolEntries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "还没有解析成功的任务进入任务池。";
    taskPool.append(empty);
    return;
  }

  for (const entry of poolEntries) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `pool-item ${entry.status}${entry.sourceFile === selectedFileName ? " active" : ""}`;
    item.innerHTML = `
      <span class="pool-title"></span>
      <span class="pool-meta"></span>
      <span class="pool-status"></span>
    `;
    item.querySelector(".pool-title").textContent = entry.title || entry.id;
    item.querySelector(".pool-meta").textContent = `${entry.sourceFile} · ${entry.type || "unknown"}`;
    item.querySelector(".pool-status").textContent = entry.status;
    item.addEventListener("click", () => selectTask(entry.sourceFile));
    taskPool.append(item);
  }
}

function renderStartupCheck() {
  startupCheckPanel.replaceChildren();
  startupCheckRaw.textContent = JSON.stringify(startupCheck, null, 2);
  renderInputs(startupCheckInputs, [
    { label: "输入", value: "当前运行环境快照" },
    { label: "activeWork", value: startupCheck?.runtimeSnapshot?.activeWork ? "存在" : "无" },
    { label: "git", value: startupCheck?.runtimeSnapshot?.worktree?.clean ? "clean" : "dirty/unknown" },
  ]);
  if (!startupCheck) {
    startupCheckStatus.textContent = "未载入";
    startupCheckPanel.textContent = "未返回启动检查。";
    return;
  }

  startupCheckStatus.textContent = startupCheck.canStartWork ? "可启动" : "不可启动";
  const summary = document.createElement("div");
  summary.className = `startup-check-summary ${startupCheck.canStartWork ? "pass" : "fail"}`;
  summary.textContent = startupCheck.canStartWork
    ? "当前可以启动新任务。"
    : "当前不能启动新任务。";

  const canStart = document.createElement("div");
  canStart.className = "startup-check-metric";
  canStart.innerHTML = "<span>canStartWork</span><strong></strong>";
  canStart.querySelector("strong").textContent = String(startupCheck.canStartWork);

  const worktree = startupCheck.runtimeSnapshot?.worktree ?? { clean: false, changedFiles: [] };
  const gitStatus = document.createElement("div");
  gitStatus.className = "startup-check-metric";
  gitStatus.innerHTML = "<span>git</span><strong></strong>";
  gitStatus.querySelector("strong").textContent = worktree.clean ? "clean" : "dirty";

  const gitChanges = document.createElement("div");
  gitChanges.className = "startup-check-metric";
  gitChanges.innerHTML = "<span>git changes</span><strong></strong>";
  gitChanges.querySelector("strong").textContent = String(worktree.changedFiles?.length ?? 0);

  startupCheckPanel.append(summary, canStart, gitStatus, gitChanges);

  const findings = startupCheck.findings ?? [];
  if (findings.length > 0) {
    const list = document.createElement("ul");
    list.className = "startup-check-list";
    for (const finding of findings) {
      const item = document.createElement("li");
      item.textContent = `${finding.code}: ${finding.message}`;
      list.append(item);
    }
    startupCheckPanel.append(list);
  }

  const changedFiles = worktree.changedFiles ?? [];
  if (changedFiles.length > 0) {
    const list = document.createElement("ul");
    list.className = "startup-check-list git-list";
    for (const filePath of changedFiles.slice(0, 6)) {
      const item = document.createElement("li");
      item.textContent = filePath;
      list.append(item);
    }
    startupCheckPanel.append(list);
  }
}

function buildRecommendationRaw(run) {
  if (!run) return "尚未触发推荐器。";
  const chunks = [];
  if (run.progress?.length > 0) {
    chunks.push(`运行进度\n${formatProgress(run.progress)}`);
  }
  if (run.stdout) chunks.push(`结构化产物(stdout)\n${stripAnsi(run.stdout)}`);
  if (run.stderr) chunks.push(`运行日志(stderr)\n${stripAnsi(run.stderr)}`);
  if (run.error) chunks.push(`错误(error)\n${stripAnsi(run.error)}`);
  return chunks.join("\n\n") || "等待输出...";
}

function renderRecommendationRun() {
  const taskContextPackage = activeTaskContextPackage();
  recommendationResult?.replaceChildren();
  recommendationIntentPanel.replaceChildren();
  admissionPanel.replaceChildren();
  taskContextPackagePanel.replaceChildren();
  humanDecisionPanel.replaceChildren();
  autoMergePanel.replaceChildren();
  autoMergeExecutionPanel.replaceChildren();
  taskCloseoutPanel.replaceChildren();
  taskContextPackageRaw.textContent = taskContextPackage
    ? JSON.stringify(taskContextPackage, null, 2)
    : "尚未生成任务上下文包。";
  recommendationRaw.textContent = buildRecommendationRaw(recommendationRun);
  if (recommendationTerminal) {
    recommendationTerminal.textContent = formatTerminalProgress(recommendationRun);
    recommendationTerminal.scrollTop = recommendationTerminal.scrollHeight;
  }
  admissionRaw.textContent = formatJsonBlock(recommendationRun?.executionIntentAppendRequest);
  renderInputs(recommendationInputs, [
    { label: "prompt", value: "project_profiles/recommender-agent.prompt.md" },
    { label: "命令", value: "opencode run --format json" },
    { label: "工作目录", value: "仓库根目录" },
    { label: "读取范围", value: "启动检查通过后注入的 candidateTasks" },
  ]);
  renderInputs(admissionInputs, [
    { label: "执行意图", value: recommendationRun?.executionIntent ? recommendationRun.executionIntent.recommendedPackageId : "未生成" },
    { label: "任务池", value: `${poolEntries.length} 个条目` },
    { label: "启动检查", value: startupCheck ? String(startupCheck.canStartWork) : "未载入" },
  ]);
  renderHumanDecision(taskContextPackage);
  renderAutoMerge(taskContextPackage);
  renderAutoMergeExecution(taskContextPackage);
  renderTaskCloseout(taskContextPackage);
  runRecommendationButton.disabled = recommendationRun?.status === "running";
  if (cancelRecommendationButton) {
    cancelRecommendationButton.hidden = recommendationRun?.status !== "running";
    cancelRecommendationButton.disabled = false;
    cancelRecommendationButton.textContent = "取消运行";
  }

  if (!recommendationRun) {
    recommendationStatus.textContent = "未运行";
    admissionStatus.textContent = "等待输入";
    if (recommendationResult) recommendationResult.textContent = "尚未触发推荐器。";
    recommendationIntentPanel.textContent = "尚未解析。";
    admissionPanel.textContent = "等待推荐器输出。";
    if (taskContextPackage) {
      taskContextPackageStatus.textContent = taskContextPackageLabel(taskContextPackage);
      taskContextPackagePanel.append(createTaskContextPackagePanel(taskContextPackage));
    } else {
      taskContextPackageStatus.textContent = "等待输入";
      taskContextPackageRaw.textContent = "等待执行准入器输出。";
      taskContextPackagePanel.textContent = "等待执行准入器输出。";
      humanDecisionStatus.textContent = "等待输入";
      humanDecisionRaw.textContent = "尚未请求人工决策。";
      humanDecisionPanel.textContent = "等待任务完成结论。";
      autoMergeStatus.textContent = "等待输入";
      autoMergeRaw.textContent = "尚未进入自动合并环节。";
      autoMergePanel.textContent = "等待人工接受完成。";
      autoMergeExecutionStatus.textContent = "等待输入";
      autoMergeExecutionRaw.textContent = "尚未执行自动合并。";
      autoMergeExecutionPanel.textContent = "等待合并计划。";
      taskCloseoutStatus.textContent = "等待输入";
      taskCloseoutRaw.textContent = "尚未收尾。";
      taskCloseoutPanel.textContent = "等待自动合并结果。";
    }
    return;
  }

  recommendationStatus.textContent = recommendationRun.status === "running"
    ? `${recommendationRun.status} · ${formatElapsed(recommendationRun.startedAt)}`
    : `${recommendationRun.status} · 用时 ${formatElapsed(recommendationRun.startedAt, recommendationRun.finishedAt)}`;
  const summary = document.createElement("div");
  summary.className = `recommendation-summary ${recommendationRun.status}`;
  summary.textContent =
    recommendationRun.status === "running"
      ? `探针正在运行... ${formatElapsed(recommendationRun.startedAt)}`
      : recommendationRun.status === "blocked"
        ? "启动检查未通过，推荐器未运行。"
      : recommendationRun.status === "cancelled"
        ? `用户已取消 · 用时 ${formatElapsed(recommendationRun.startedAt, recommendationRun.finishedAt)}`
      : `exitCode: ${String(recommendationRun.exitCode)} · 用时 ${formatElapsed(recommendationRun.startedAt, recommendationRun.finishedAt)}`;

  const meta = document.createElement("div");
  meta.className = "recommendation-meta";
  meta.textContent = recommendationRun.command
    ? `${recommendationRun.command} ${recommendationRun.args?.join(" ") ?? ""}`
    : "未启动外部命令";

  if (recommendationRun.executionIntent) {
    recommendationResult?.append(summary, meta, createIntentPanel(recommendationRun.executionIntent));
    recommendationIntentPanel.append(createIntentPanel(recommendationRun.executionIntent));
  } else {
    recommendationResult?.append(summary, meta);
    recommendationIntentPanel.textContent = recommendationRun.executionIntentError
      ? `解析失败：${recommendationRun.executionIntentError}`
      : "尚未解析出执行意图。";
  }

  if (recommendationRun.executionAdmission) {
    admissionStatus.textContent = recommendationRun.executionAdmission.appendRequest?.artifactType ?? "未知";
    admissionPanel.append(createAdmissionPanel(recommendationRun.executionAdmission));
  } else {
    admissionStatus.textContent = "等待输入";
    admissionPanel.textContent = "尚未计算执行授权。";
  }

  if (taskContextPackage) {
    taskContextPackageStatus.textContent = taskContextPackageLabel(taskContextPackage);
    taskContextPackagePanel.append(createTaskContextPackagePanel(taskContextPackage));
  } else {
    taskContextPackageStatus.textContent = "未生成";
    taskContextPackagePanel.textContent = "尚未生成任务上下文包快照。";
  }

  const output = document.createElement("pre");
  output.className = "recommendation-output";
  const chunks = [];
  if (recommendationRun.executionIntentError) {
    chunks.push(`解析失败\n${recommendationRun.executionIntentError}`);
  }
  output.textContent = chunks.concat(buildRecommendationRaw(recommendationRun)).join("\n\n") || "等待输出...";

  recommendationResult?.append(output);
}

function selectTask(fileName) {
  selectedFileName = fileName;
  const task = tasks.find((item) => item.fileName === fileName);
  if (!task) return;

  selectedTitle.textContent = task.fileName;
  selectedMeta.textContent = `${task.format.toUpperCase()} 任务真源`;
  rawText.textContent = task.rawText || "(空文件)";
  parseStatus.textContent = "原始文本";
  if (parsedText) parsedText.textContent = "";
  if (validationResult) validationResult.textContent = "";
  if (validationStatus) validationStatus.textContent = "未展示";
  renderList();
  renderTaskPool();
  renderRecommendationRun();
}

function renderValidation(validation) {
  validationResult.replaceChildren();
  if (!validation) {
    validationStatus.textContent = "未校验";
    validationResult.textContent = "未返回校验结果。";
    return;
  }

  const summary = document.createElement("div");
  summary.className = `validation-summary ${validation.status}`;
  if (validation.status === "valid") {
    validationStatus.textContent = "校验通过";
    summary.textContent = "该任务满足进入后续流程的最小字段要求。";
    validationResult.append(summary);
    return;
  }

  validationStatus.textContent = "校验未通过";
  summary.textContent = "该任务暂时不能进入下一阶段。";
  const list = document.createElement("ul");
  list.className = "validation-errors";
  for (const error of validation.errors ?? []) {
    const item = document.createElement("li");
    item.textContent = error;
    list.append(item);
  }
  validationResult.append(summary, list);
}

async function loadTasks() {
  rawText.textContent = "正在读取 tasks/ ...";
  if (parsedText) parsedText.textContent = "";
  if (validationResult) validationResult.textContent = "";
  parseStatus.textContent = "等待载入";
  if (validationStatus) validationStatus.textContent = "等待载入";
  startupCheckPanel.textContent = "正在读取启动检查...";
  startupCheckStatus.textContent = "等待载入";
  const [tasksResponse, poolResponse, startupCheckResponse] = await Promise.all([
    fetch("/api/tasks"),
    fetch("/api/task-pool"),
    fetch("/api/startup-check"),
  ]);
  if (!tasksResponse.ok) {
    throw new Error(`读取任务失败：${tasksResponse.status}`);
  }
  if (!poolResponse.ok) {
    throw new Error(`读取任务池失败：${poolResponse.status}`);
  }
  if (!startupCheckResponse.ok) {
    throw new Error(`读取启动检查失败：${startupCheckResponse.status}`);
  }

  const tasksPayload = await tasksResponse.json();
  const poolPayload = await poolResponse.json();
  const startupCheckPayload = await startupCheckResponse.json();
  tasks = tasksPayload.tasks ?? [];
  poolEntries = poolPayload.taskPool?.entries ?? [];
  poolTaskContextPackages = poolPayload.taskPool?.taskContextPackages ?? [];
  startupCheck = startupCheckPayload.startupCheck ?? null;
  selectedFileName = tasks.some((task) => task.fileName === selectedFileName)
    ? selectedFileName
    : tasks[0]?.fileName ?? null;

  renderList();
  renderTaskPool();
  renderStartupCheck();

  if (selectedFileName) {
    selectTask(selectedFileName);
  } else {
    selectedTitle.textContent = "未发现任务";
    selectedMeta.textContent = "在 tasks/ 目录添加 YAML 文件后刷新。";
    rawText.textContent = "";
    if (parsedText) parsedText.textContent = "";
    if (validationResult) validationResult.textContent = "";
    parseStatus.textContent = "无任务";
    if (validationStatus) validationStatus.textContent = "无任务";
  }

  renderRecommendationRun();
}

async function loadRecommendationRun() {
  const response = await fetch("/api/recommendation-runs/latest");
  if (!response.ok) {
    throw new Error(`读取推荐器失败：${response.status}`);
  }
  const payload = await response.json();
  recommendationRun = payload.recommendationRun ?? null;
  latestRecommendationSyncAt = Date.now();
  renderRecommendationRun();
}

async function syncRecommendationRunSilently() {
  try {
    await loadRecommendationRun();
  } catch {
    if (recommendationRun?.status === "running") {
      recommendationStatus.textContent = `running · 连接中断 · ${formatElapsed(recommendationRun.startedAt)}`;
    }
  }
}

async function createRecommendationRun() {
  runRecommendationButton.disabled = true;
  if (cancelRecommendationButton) {
    cancelRecommendationButton.hidden = true;
  }
  recommendationStatus.textContent = "启动中";
  if (recommendationResult) recommendationResult.textContent = "正在启动推荐器...";
  const response = await fetch("/api/recommendation-runs", { method: "POST" });
  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 409 && payload.recommendationRun) {
      recommendationRun = payload.recommendationRun;
      renderRecommendationRun();
      return;
    }
    throw new Error(`启动推荐器失败：${response.status}`);
  }
  recommendationRun = payload.recommendationRun ?? null;
  renderRecommendationRun();
}

async function cancelRecommendationRun() {
  if (!cancelRecommendationButton) return;
  cancelRecommendationButton.disabled = true;
  cancelRecommendationButton.textContent = "取消中";
  const response = await fetch("/api/recommendation-runs/cancel", { method: "POST" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `取消运行失败：${response.status}`);
  }
  recommendationRun = payload.recommendationRun ?? null;
  renderRecommendationRun();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(500);
    try {
      const response = await fetch(`/api/startup-check?restartProbe=${Date.now()}`, {
        cache: "no-store",
      });
      if (response.ok) return;
    } catch {
      // The server is expected to be unavailable briefly while restarting.
    }
  }
  throw new Error("服务重启超时，请手动刷新页面确认。");
}

async function restartServer() {
  restartButton.disabled = true;
  refreshButton.disabled = true;
  restartButton.textContent = "重启中";
  const response = await fetch("/api/server/restart", { method: "POST" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `重启失败：${response.status}`);
  }
  await sleep(1000);
  await waitForServerReady();
  restartButton.textContent = "已重启";
  await Promise.all([loadTasks(), loadRecommendationRun()]);
  restartButton.disabled = false;
  refreshButton.disabled = false;
  restartButton.textContent = "重启";
}

restartButton.addEventListener("click", () => {
  restartServer().catch((error) => {
    restartButton.disabled = false;
    refreshButton.disabled = false;
    restartButton.textContent = "重启";
    showError(error);
  });
});

refreshButton.addEventListener("click", () => {
  Promise.all([loadTasks(), loadRecommendationRun()]).catch(showError);
});

runRecommendationButton.addEventListener("click", () => {
  createRecommendationRun().catch(showError);
});

cancelRecommendationButton?.addEventListener("click", () => {
  cancelRecommendationRun().catch(showError);
});

function connectWorkflowEvents() {
  if (!("EventSource" in window)) return;
  const events = new EventSource("/api/events");
  events.addEventListener("open", () => {
    Promise.all([loadTasks(), loadRecommendationRun()]).catch(() => {});
  });
  events.addEventListener("error", () => {
    if (recommendationRun?.status === "running") {
      recommendationStatus.textContent = `running · 连接中断 · ${formatElapsed(recommendationRun.startedAt)}`;
      setTimeout(() => {
        syncRecommendationRunSilently();
      }, 1500);
    }
  });
  events.addEventListener("tasks-changed", () => {
    loadTasks().catch(showError);
  });
  events.addEventListener("recommendation-run-changed", () => {
    Promise.all([loadTasks(), loadRecommendationRun()]).catch(showError);
  });
}

function showError(error) {
  selectedTitle.textContent = "读取失败";
  selectedMeta.textContent = "请查看服务端日志。";
  rawText.textContent = error.message;
  if (parsedText) parsedText.textContent = "";
  if (validationResult) validationResult.textContent = "";
  startupCheckPanel.textContent = "";
  parseStatus.textContent = "失败";
  if (validationStatus) validationStatus.textContent = "失败";
  startupCheckStatus.textContent = "失败";
  recommendationStatus.textContent = "失败";
  if (recommendationResult) recommendationResult.textContent = error.message;
  runRecommendationButton.disabled = false;
  if (cancelRecommendationButton) {
    cancelRecommendationButton.disabled = false;
    cancelRecommendationButton.textContent = "取消运行";
  }
}

Promise.all([loadTasks(), loadRecommendationRun()]).catch(showError);
connectWorkflowEvents();
setInterval(() => {
  if (recommendationRun?.status === "running") {
    renderRecommendationRun();
    if (Date.now() - latestRecommendationSyncAt > 5000) {
      syncRecommendationRunSilently();
    }
  }
}, 1000);
