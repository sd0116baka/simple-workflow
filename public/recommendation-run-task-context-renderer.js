const DEFAULT_EMPTY_STATE = {
  taskContextPackageStatus: "未生成",
  taskContextPackageRaw: "尚未生成任务上下文包。",
  taskContextPackagePanel: "尚未生成任务上下文包快照。",
};

function taskContextPackageLabel(taskContextPackage) {
  const sourceFile = taskContextPackage.source?.path?.split("/").pop() ?? taskContextPackage.packageId;
  return `${sourceFile} · ${taskContextPackage.currentWorkStage}`;
}

export function renderRecommendationRunTaskContext({
  elements,
  taskContextPackage,
  workflowPanelRenderers,
  emptyState = DEFAULT_EMPTY_STATE,
}) {
  if (taskContextPackage) {
    elements.taskContextPackageStatus.textContent = taskContextPackageLabel(taskContextPackage);
    elements.taskContextPackageRaw.textContent = JSON.stringify(taskContextPackage, null, 2);
    elements.taskContextPackagePanel.append(
      workflowPanelRenderers.createTaskContextPackagePanel(taskContextPackage),
    );
    return;
  }

  elements.taskContextPackageStatus.textContent =
    emptyState.taskContextPackageStatus ?? DEFAULT_EMPTY_STATE.taskContextPackageStatus;
  elements.taskContextPackageRaw.textContent =
    emptyState.taskContextPackageRaw ?? DEFAULT_EMPTY_STATE.taskContextPackageRaw;
  elements.taskContextPackagePanel.textContent =
    emptyState.taskContextPackagePanel ?? DEFAULT_EMPTY_STATE.taskContextPackagePanel;
}
