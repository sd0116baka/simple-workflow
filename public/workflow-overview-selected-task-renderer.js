function buildSelectedTaskViewModel(task) {
  return {
    title: task.fileName,
    meta: `${task.format.toUpperCase()} 任务真源`,
    rawText: task.rawText || "(空文件)",
    parseStatus: "原始文本",
    parsedText: "",
    validationText: "",
    validationStatus: "未展示",
  };
}

function buildMissingTaskSelectionViewModel() {
  return {
    title: "未发现任务",
    meta: "在 tasks/ 目录添加 YAML 文件后刷新。",
    rawText: "",
    parsedText: "",
    validationText: "",
    parseStatus: "无任务",
    validationStatus: "无任务",
  };
}

export function renderSelectedTaskOverview({
  selectedTitle,
  selectedMeta,
  rawText,
  parsedText,
  parseStatus,
  validationResult,
  validationStatus,
  task,
}) {
  const viewModel = buildSelectedTaskViewModel(task);
  selectedTitle.textContent = viewModel.title;
  selectedMeta.textContent = viewModel.meta;
  rawText.textContent = viewModel.rawText;
  parseStatus.textContent = viewModel.parseStatus;
  if (parsedText) parsedText.textContent = viewModel.parsedText;
  if (validationResult) validationResult.textContent = viewModel.validationText;
  if (validationStatus) validationStatus.textContent = viewModel.validationStatus;
  return viewModel;
}

export function renderMissingTaskSelectionOverview({
  selectedTitle,
  selectedMeta,
  rawText,
  parsedText,
  parseStatus,
  validationResult,
  validationStatus,
}) {
  const viewModel = buildMissingTaskSelectionViewModel();
  selectedTitle.textContent = viewModel.title;
  selectedMeta.textContent = viewModel.meta;
  rawText.textContent = viewModel.rawText;
  if (parsedText) parsedText.textContent = viewModel.parsedText;
  if (validationResult) validationResult.textContent = viewModel.validationText;
  parseStatus.textContent = viewModel.parseStatus;
  if (validationStatus) validationStatus.textContent = viewModel.validationStatus;
  return viewModel;
}
