const taskList = document.querySelector("#taskList");
const taskCount = document.querySelector("#taskCount");
const selectedTitle = document.querySelector("#selectedTitle");
const selectedMeta = document.querySelector("#selectedMeta");
const rawText = document.querySelector("#rawText");
const parsedText = document.querySelector("#parsedText");
const parseStatus = document.querySelector("#parseStatus");
const validationResult = document.querySelector("#validationResult");
const validationStatus = document.querySelector("#validationStatus");
const refreshButton = document.querySelector("#refreshButton");

let tasks = [];
let selectedFileName = null;

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
  const response = await fetch("/api/tasks");
  if (!response.ok) {
    throw new Error(`读取失败：${response.status}`);
  }

  const payload = await response.json();
  tasks = payload.tasks ?? [];
  selectedFileName = tasks.some((task) => task.fileName === selectedFileName)
    ? selectedFileName
    : tasks[0]?.fileName ?? null;

  renderList();

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

refreshButton.addEventListener("click", () => {
  loadTasks().catch(showError);
});

function connectWorkflowEvents() {
  if (!("EventSource" in window)) return;
  const events = new EventSource("/api/events");
  events.addEventListener("tasks-changed", () => {
    loadTasks().catch(showError);
  });
}

function showError(error) {
  selectedTitle.textContent = "读取失败";
  selectedMeta.textContent = "请查看服务端日志。";
  rawText.textContent = error.message;
  parsedText.textContent = "";
  validationResult.textContent = "";
  parseStatus.textContent = "失败";
  validationStatus.textContent = "失败";
}

loadTasks().catch(showError);
connectWorkflowEvents();
