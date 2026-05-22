export function connectWorkflowEventStream({
  EventSourceCtor,
  loadTasks,
  loadRecommendationRun,
  syncRecommendationRunSilently,
  showError,
  onConnectionError = () => false,
  setTimeoutFn = setTimeout,
  streamUrl = "/api/events",
  retryDelayMs = 1500,
} = {}) {
  if (!EventSourceCtor) return null;
  const events = new EventSourceCtor(streamUrl);

  events.addEventListener("open", () => {
    Promise.all([loadTasks(), loadRecommendationRun()]).catch(() => {});
  });
  events.addEventListener("error", () => {
    if (onConnectionError()) {
      setTimeoutFn(() => {
        syncRecommendationRunSilently();
      }, retryDelayMs);
    }
  });
  events.addEventListener("tasks-changed", () => {
    loadTasks().catch(showError);
  });
  events.addEventListener("recommendation-run-changed", () => {
    Promise.all([loadTasks(), loadRecommendationRun()]).catch(showError);
  });

  return events;
}

export function startRecommendationRunRefreshLoop({
  isRecommendationRunRunning,
  renderRecommendationRun,
  latestRecommendationSyncAt,
  syncRecommendationRunSilently,
  now = Date.now,
  setIntervalFn = setInterval,
  intervalMs = 1000,
  staleAfterMs = 5000,
} = {}) {
  return setIntervalFn(() => {
    if (!isRecommendationRunRunning()) return;
    renderRecommendationRun();
    if (now() - latestRecommendationSyncAt() > staleAfterMs) {
      syncRecommendationRunSilently();
    }
  }, intervalMs);
}
