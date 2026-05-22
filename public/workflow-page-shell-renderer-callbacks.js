export function createWorkflowPanelRendererCallbacks({
  getCommands,
  showError,
}) {
  return {
    onAcceptConvergence: (...args) => getCommands().acceptConvergence(...args),
    onContinueConvergenceWithGuidance: (...args) =>
      getCommands().continueConvergenceWithGuidance(...args),
    onCancelTask: (...args) => getCommands().cancelTask(...args),
    showError,
  };
}

export function createWorkflowOverviewRendererCallbacks({
  getDataController,
}) {
  return {
    onSelectTask: (fileName) => getDataController().selectTask(fileName),
  };
}

export function createWorkflowRecommendationRunRendererCallbacks({
  getDataController,
}) {
  return {
    renderWorkflowSections: (taskContextPackage) =>
      getDataController().renderWorkflowSections(taskContextPackage),
  };
}
