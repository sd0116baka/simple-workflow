const taskList = document.querySelector("#taskList");
const taskCount = document.querySelector("#taskCount");
const taskPool = document.querySelector("#taskPool");
const poolCount = document.querySelector("#poolCount");
const runtimePanel = document.querySelector("#runtimePanel");
const runtimeStatus = document.querySelector("#runtimeStatus");
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
const runtimeRaw = document.querySelector("#runtimeRaw");
const recommendationRaw = document.querySelector("#recommendationRaw");
const recommendationIntentPanel = document.querySelector("#recommendationIntentPanel");

let tasks = [];
let poolEntries = [];
let runtime = null;
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

function createIntentPanel(intent) {
  const panel = document.createElement("div");
  panel.className = "recommendation-intent";

  const title = document.createElement("div");
  title.className = "recommendation-intent-title";
  title.textContent = intent.recommendedTask.title || intent.recommendedTask.id;

  const meta = document.createElement("div");
  meta.className = "recommendation-intent-meta";
  meta.textContent = `${intent.recommendedTask.id} · ${intent.recommendedTask.priority} · confidence: ${intent.confidence}`;

  const nextAction = document.createElement("div");
  nextAction.className = "recommendation-intent-next";
  nextAction.textContent = intent.nextAction;

  panel.append(title, meta, nextAction);

  if (intent.rationale?.length > 0) {
    const list = document.createElement("ul");
    list.className = "recommendation-intent-list";
    for (const reason of intent.rationale) {
      const item = document.createElement("li");
      item.textContent = reason;
      list.append(item);
    }
    panel.append(list);
  }

  if (intent.observedTasks?.length > 0) {
    const observed = document.createElement("div");
    observed.className = "recommendation-observed";
    observed.textContent = `observedTasks: ${intent.observedTasks
      .map((task) => `${task.id}:${task.priority}${task.status ? `:${task.status}` : ""}`)
      .join(", ")}`;
    panel.append(observed);
  }

  return panel;
}

function renderList() {
  taskCount.textContent = `${tasks.length} 个文件`;
  taskList.replaceChildren();

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

function renderRuntime() {
  runtimePanel.replaceChildren();
  runtimeRaw.textContent = JSON.stringify(runtime, null, 2);
  if (!runtime) {
    runtimeStatus.textContent = "未载入";
    runtimePanel.textContent = "未返回运行时状态。";
    return;
  }

  runtimeStatus.textContent = runtime.status;
  const summary = document.createElement("div");
  summary.className = `runtime-summary ${runtime.status}`;
  summary.textContent = runtime.canStartNewTask
    ? "当前可以启动新任务。"
    : "当前不能启动新任务。";

  const canStart = document.createElement("div");
  canStart.className = "runtime-metric";
  canStart.innerHTML = "<span>canStartNewTask</span><strong></strong>";
  canStart.querySelector("strong").textContent = String(runtime.canStartNewTask);

  const runnableCount = document.createElement("div");
  runnableCount.className = "runtime-metric";
  runnableCount.innerHTML = "<span>runnableTasks</span><strong></strong>";
  runnableCount.querySelector("strong").textContent = String(runtime.runnableTasks?.length ?? 0);

  const repositoryStatus = runtime.repositoryStatus ?? { clean: false, entries: [] };
  const gitStatus = document.createElement("div");
  gitStatus.className = "runtime-metric";
  gitStatus.innerHTML = "<span>git</span><strong></strong>";
  gitStatus.querySelector("strong").textContent = repositoryStatus.clean ? "clean" : "dirty";

  const gitChanges = document.createElement("div");
  gitChanges.className = "runtime-metric";
  gitChanges.innerHTML = "<span>git changes</span><strong></strong>";
  gitChanges.querySelector("strong").textContent = String(repositoryStatus.entries?.length ?? 0);

  runtimePanel.append(summary, canStart, runnableCount, gitStatus, gitChanges);

  const reasons = runtime.blockingReasons ?? [];
  if (reasons.length > 0) {
    const list = document.createElement("ul");
    list.className = "runtime-list";
    for (const reason of reasons) {
      const item = document.createElement("li");
      item.textContent = reason;
      list.append(item);
    }
    runtimePanel.append(list);
  }

  const repositoryEntries = repositoryStatus.entries ?? [];
  if (repositoryEntries.length > 0) {
    const list = document.createElement("ul");
    list.className = "runtime-list git-list";
    for (const entry of repositoryEntries.slice(0, 6)) {
      const item = document.createElement("li");
      item.textContent = `${entry.code} ${entry.path}`;
      list.append(item);
    }
    runtimePanel.append(list);
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
  recommendationRaw.textContent = buildRecommendationRaw(recommendationRun);
  runRecommendationButton.disabled = recommendationRun?.status === "running";

  if (!recommendationRun) {
    recommendationStatus.textContent = "未运行";
    if (recommendationResult) recommendationResult.textContent = "尚未触发推荐器。";
    recommendationIntentPanel.textContent = "尚未解析。";
    return;
  }

  recommendationStatus.textContent = recommendationRun.status;
  const summary = document.createElement("div");
  summary.className = `recommendation-summary ${recommendationRun.status}`;
  summary.textContent =
    recommendationRun.status === "running"
      ? "探针正在运行..."
      : `exitCode: ${String(recommendationRun.exitCode)}`;

  const meta = document.createElement("div");
  meta.className = "recommendation-meta";
  meta.textContent = `${recommendationRun.command} ${recommendationRun.args?.join(" ") ?? ""}`;

  if (recommendationRun.executionIntent) {
    recommendationResult?.append(summary, meta, createIntentPanel(recommendationRun.executionIntent));
    recommendationIntentPanel.append(createIntentPanel(recommendationRun.executionIntent));
  } else {
    recommendationResult?.append(summary, meta);
    recommendationIntentPanel.textContent = recommendationRun.executionIntentError
      ? `解析失败：${recommendationRun.executionIntentError}`
      : "尚未解析出执行意图。";
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
  runtimePanel.textContent = "正在读取运行时状态...";
  runtimeStatus.textContent = "等待载入";
  const [tasksResponse, poolResponse, runtimeResponse] = await Promise.all([
    fetch("/api/tasks"),
    fetch("/api/task-pool"),
    fetch("/api/runtime"),
  ]);
  if (!tasksResponse.ok) {
    throw new Error(`读取任务失败：${tasksResponse.status}`);
  }
  if (!poolResponse.ok) {
    throw new Error(`读取任务池失败：${poolResponse.status}`);
  }
  if (!runtimeResponse.ok) {
    throw new Error(`读取运行时失败：${runtimeResponse.status}`);
  }

  const tasksPayload = await tasksResponse.json();
  const poolPayload = await poolResponse.json();
  const runtimePayload = await runtimeResponse.json();
  tasks = tasksPayload.tasks ?? [];
  poolEntries = poolPayload.taskPool?.entries ?? [];
  runtime = runtimePayload.runtimeStatus ?? null;
  selectedFileName = tasks.some((task) => task.fileName === selectedFileName)
    ? selectedFileName
    : tasks[0]?.fileName ?? null;

  renderList();
  renderTaskPool();
  renderRuntime();

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
  runtimePanel.textContent = "";
  parseStatus.textContent = "失败";
  validationStatus.textContent = "失败";
  runtimeStatus.textContent = "失败";
  recommendationStatus.textContent = "失败";
  if (recommendationResult) recommendationResult.textContent = error.message;
  runRecommendationButton.disabled = false;
}

Promise.all([loadTasks(), loadRecommendationRun()]).catch(showError);
connectWorkflowEvents();
