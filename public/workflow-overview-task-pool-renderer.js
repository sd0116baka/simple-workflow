import {
  appendEmptyState,
  createElement,
  renderInputs,
} from "./dom-renderer-helpers.js";

function buildTaskPoolViewModel({
  tasks = [],
  poolEntries = [],
  selectedFileName = null,
} = {}) {
  return {
    countText: `${poolEntries.length} 个条目`,
    rawText: JSON.stringify(poolEntries, null, 2),
    inputs: [
      { label: "输入", value: "任务真源解析结果" },
      { label: "任务文件", value: tasks.map((task) => task.fileName).join(", ") || "无" },
      { label: "过滤规则", value: "只接收 parseError 为空且有 parsed 的任务" },
    ],
    emptyText: poolEntries.length === 0 ? "还没有解析成功的任务进入任务池。" : null,
    items: poolEntries.map((entry) => ({
      sourceFile: entry.sourceFile,
      title: entry.title || entry.id,
      meta: `${entry.sourceFile} · ${entry.type || "unknown"}`,
      status: entry.status,
      className: `pool-item ${entry.status}${entry.sourceFile === selectedFileName ? " active" : ""}`,
    })),
  };
}

export function renderTaskPoolOverview({
  documentRef,
  onSelectTask,
  taskPool,
  poolCount,
  taskPoolRaw,
  taskPoolInputs,
  tasks,
  poolEntries,
  selectedFileName,
}) {
  const viewModel = buildTaskPoolViewModel({ tasks, poolEntries, selectedFileName });
  poolCount.textContent = viewModel.countText;
  taskPool.replaceChildren();
  taskPoolRaw.textContent = viewModel.rawText;
  renderInputs(documentRef, taskPoolInputs, viewModel.inputs);

  if (viewModel.emptyText) {
    appendEmptyState(documentRef, taskPool, viewModel.emptyText);
    return viewModel;
  }

  for (const entry of viewModel.items) {
    const item = createElement(documentRef, "button", { className: entry.className });
    item.type = "button";
    item.append(
      createElement(documentRef, "span", {
        className: "pool-title",
        textContent: entry.title,
      }),
      createElement(documentRef, "span", {
        className: "pool-meta",
        textContent: entry.meta,
      }),
      createElement(documentRef, "span", {
        className: "pool-status",
        textContent: entry.status,
      }),
    );
    item.addEventListener("click", () => onSelectTask(entry.sourceFile));
    taskPool.append(item);
  }
  return viewModel;
}
