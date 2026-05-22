export function appendWorkflowSectionPanel(
  container,
  panel,
  taskContextPackage,
  panelRenderers,
) {
  if (!panel) return false;
  if (panel.kind === "humanDecision") {
    container.append(panelRenderers.createHumanDecisionPanel(taskContextPackage));
    return true;
  }
  if (panel.kind === "autoMergePlan") {
    container.append(panelRenderers.createAutoMergePanel(taskContextPackage));
    return true;
  }
  if (panel.kind === "autoMergeExecution") {
    container.append(panelRenderers.createAutoMergeExecutionPanel(taskContextPackage));
    return true;
  }
  if (panel.kind === "taskCloseout") {
    container.append(panelRenderers.createTaskCloseoutPanel(taskContextPackage));
    return true;
  }
  if (panel.kind === "list") {
    container.append(panelRenderers.createListPanel(panel.viewModel));
    return true;
  }
  return false;
}
