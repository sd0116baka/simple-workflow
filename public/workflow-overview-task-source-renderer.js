import {
  appendEmptyState,
  createElement,
  renderInputs,
} from "./dom-renderer-helpers.js";

function buildTaskSourceViewModel({ tasks = [], selectedFileName = null } = {}) {
  return {
    countText: `${tasks.length} 个文件`,
    inputs: [
      { label: "目录", value: "tasks/" },
      { label: "文件类型", value: ".yaml, .yml" },
      { label: "当前选择", value: selectedFileName ?? "未选择" },
      { label: "文件数量", value: `${tasks.length}` },
    ],
    emptyText: tasks.length === 0 ? "tasks/ 目录下还没有 .yaml 或 .yml 文件。" : null,
    items: tasks.map((task) => ({
      fileName: task.fileName,
      format: task.format,
      active: task.fileName === selectedFileName,
    })),
  };
}

export function renderTaskSourceOverview({
  documentRef,
  onSelectTask,
  taskList,
  taskCount,
  taskSourceInputs,
  tasks,
  selectedFileName,
}) {
  const viewModel = buildTaskSourceViewModel({ tasks, selectedFileName });
  taskCount.textContent = viewModel.countText;
  taskList.replaceChildren();
  renderInputs(documentRef, taskSourceInputs, viewModel.inputs);

  if (viewModel.emptyText) {
    appendEmptyState(documentRef, taskList, viewModel.emptyText);
    return viewModel;
  }

  for (const task of viewModel.items) {
    const button = createElement(documentRef, "button", {
      className: `task-item${task.active ? " active" : ""}`,
    });
    button.type = "button";
    button.append(
      createElement(documentRef, "span", {
        className: "task-file",
        textContent: task.fileName,
      }),
      createElement(documentRef, "span", {
        className: "task-format",
        textContent: task.format,
      }),
    );
    button.addEventListener("click", () => onSelectTask(task.fileName));
    taskList.append(button);
  }
  return viewModel;
}
