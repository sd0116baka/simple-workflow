export function startWorkflowPageInitialLoad({
  workflowPageDataController,
  showError,
}) {
  return Promise.all([
    workflowPageDataController.loadTasks(),
    workflowPageDataController.loadRecommendationRun(),
    workflowPageDataController.loadTerminalSession(),
  ]).catch(showError);
}

export function connectWorkflowPageShellEvents({
  EventSourceCtor,
  connectEventStream,
  workflowPageDataController,
  showError,
}) {
  return connectEventStream({
    EventSourceCtor,
    loadTasks: workflowPageDataController.loadTasks,
    loadRecommendationRun: workflowPageDataController.loadRecommendationRun,
    syncRecommendationRunSilently:
      workflowPageDataController.syncRecommendationRunSilently,
    loadTerminalSession: workflowPageDataController.loadTerminalSession,
    showError,
    onConnectionError: () =>
      workflowPageDataController.markRecommendationConnectionInterrupted(),
  });
}

export function startWorkflowPageShellRefreshLoop({
  startRefreshLoop,
  workflowPageDataController,
}) {
  return startRefreshLoop({
    isRecommendationRunRunning:
      workflowPageDataController.isRecommendationRunRunning,
    renderRecommendationRun: workflowPageDataController.renderRecommendationRun,
    latestRecommendationSyncAt:
      workflowPageDataController.latestRecommendationSyncAt,
    syncRecommendationRunSilently:
      workflowPageDataController.syncRecommendationRunSilently,
  });
}
