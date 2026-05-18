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
const refreshButton = document.querySelector("#refreshButton");
const recommendationStatus = document.querySelector("#recommendationStatus");
const recommendationResult = document.querySelector("#recommendationResult");
const runRecommendationButton = document.querySelector("#runRecommendationButton");
const taskPoolRaw = document.querySelector("#taskPoolRaw");
const startupCheckRaw = document.querySelector("#startupCheckRaw");
const recommendationRaw = document.querySelector("#recommendationRaw");
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

let tasks = [];
let poolEntries = [];
let startupCheck = null;
let recommendationRun = null;
let selectedFileName = null;

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
  `;
  const values = artifacts.querySelectorAll("strong");
  values[0].textContent = taskContextPackage.qualityGate?.outcome ?? "missing";
  values[1].textContent = taskContextPackage.artifacts?.executionIntent ? "已追加" : "未追加";
  values[2].textContent = taskContextPackage.artifacts?.executionAuthorization
    ? "已追加"
    : taskContextPackage.artifacts?.admissionRejection
      ? "未授权"
      : "未追加";
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
        item.querySelector("em").textContent = body.reason ?? body.executionBrief?.goalInterpretation ?? "";
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
    const item = document.createElement("div");
    item.className = `pool-item ${entry.status}`;
    item.innerHTML = `
      <span class="pool-title"></span>
      <span class="pool-meta"></span>
      <span class="pool-status"></span>
    `;
    item.querySelector(".pool-title").textContent = entry.title || entry.id;
    item.querySelector(".pool-meta").textContent = `${entry.sourceFile} · ${entry.type || "unknown"}`;
    item.querySelector(".pool-status").textContent = entry.status;
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
  recommendationResult?.replaceChildren();
  recommendationIntentPanel.replaceChildren();
  admissionPanel.replaceChildren();
  taskContextPackagePanel.replaceChildren();
  taskContextPackageRaw.textContent = recommendationRun?.taskContextPackage
    ? JSON.stringify(recommendationRun.taskContextPackage, null, 2)
    : "尚未生成任务上下文包。";
  recommendationRaw.textContent = buildRecommendationRaw(recommendationRun);
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
  runRecommendationButton.disabled = recommendationRun?.status === "running";

  if (!recommendationRun) {
    recommendationStatus.textContent = "未运行";
    admissionStatus.textContent = "等待输入";
    if (recommendationResult) recommendationResult.textContent = "尚未触发推荐器。";
    recommendationIntentPanel.textContent = "尚未解析。";
    admissionPanel.textContent = "等待推荐器输出。";
    taskContextPackageStatus.textContent = "等待输入";
    taskContextPackageRaw.textContent = "等待执行准入器输出。";
    taskContextPackagePanel.textContent = "等待执行准入器输出。";
    return;
  }

  recommendationStatus.textContent = recommendationRun.status;
  const summary = document.createElement("div");
  summary.className = `recommendation-summary ${recommendationRun.status}`;
  summary.textContent =
    recommendationRun.status === "running"
      ? `探针正在运行... ${formatElapsed(recommendationRun.startedAt)}`
      : recommendationRun.status === "blocked"
        ? "启动检查未通过，推荐器未运行。"
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

  if (recommendationRun.taskContextPackage) {
    taskContextPackageStatus.textContent = recommendationRun.taskContextPackage.currentWorkStage;
    taskContextPackagePanel.append(createTaskContextPackagePanel(recommendationRun.taskContextPackage));
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
  if (task.parseError) {
    parseStatus.textContent = "解析失败";
    parsedText.classList.add("parse-error");
    parsedText.textContent = task.parseError;
  } else {
    parseStatus.textContent = "已解析";
    parsedText.classList.remove("parse-error");
    parsedText.textContent = JSON.stringify(task.parsed, null, 2);
  }
  renderValidation(task.validation);
  renderList();
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
  parsedText.textContent = "正在读取 tasks/ ...";
  validationResult.textContent = "正在读取 tasks/ ...";
  parseStatus.textContent = "等待载入";
  validationStatus.textContent = "等待载入";
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
    parsedText.textContent = "";
    validationResult.textContent = "";
    parseStatus.textContent = "无任务";
    validationStatus.textContent = "无任务";
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
  renderRecommendationRun();
}

async function createRecommendationRun() {
  runRecommendationButton.disabled = true;
  recommendationStatus.textContent = "启动中";
  if (recommendationResult) recommendationResult.textContent = "正在启动推荐器...";
  const response = await fetch("/api/recommendation-runs", { method: "POST" });
  if (!response.ok) {
    throw new Error(`启动推荐器失败：${response.status}`);
  }
  const payload = await response.json();
  recommendationRun = payload.recommendationRun ?? null;
  renderRecommendationRun();
}

refreshButton.addEventListener("click", () => {
  Promise.all([loadTasks(), loadRecommendationRun()]).catch(showError);
});

runRecommendationButton.addEventListener("click", () => {
  createRecommendationRun().catch(showError);
});

function connectWorkflowEvents() {
  if (!("EventSource" in window)) return;
  const events = new EventSource("/api/events");
  events.addEventListener("tasks-changed", () => {
    loadTasks().catch(showError);
  });
  events.addEventListener("recommendation-run-changed", () => {
    loadRecommendationRun().catch(showError);
  });
}

function showError(error) {
  selectedTitle.textContent = "读取失败";
  selectedMeta.textContent = "请查看服务端日志。";
  rawText.textContent = error.message;
  parsedText.textContent = "";
  validationResult.textContent = "";
  startupCheckPanel.textContent = "";
  parseStatus.textContent = "失败";
  validationStatus.textContent = "失败";
  startupCheckStatus.textContent = "失败";
  recommendationStatus.textContent = "失败";
  if (recommendationResult) recommendationResult.textContent = error.message;
  runRecommendationButton.disabled = false;
}

Promise.all([loadTasks(), loadRecommendationRun()]).catch(showError);
connectWorkflowEvents();
setInterval(() => {
  if (recommendationRun?.status === "running") {
    renderRecommendationRun();
  }
}, 1000);
