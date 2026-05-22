import { formatElapsed } from "./workflow-formatters.js";

export function createWorkflowPageRecommendationSyncState() {
  return {
    recommendationRun: null,
    latestSyncAt: 0,
  };
}

export function setWorkflowPageRecommendationRun(
  recommendationSyncState,
  nextRecommendationRun,
) {
  return {
    ...recommendationSyncState,
    recommendationRun: nextRecommendationRun ?? null,
  };
}

export function markWorkflowPageRecommendationSynced(
  recommendationSyncState,
  { now = Date.now } = {},
) {
  return {
    ...recommendationSyncState,
    latestSyncAt: now(),
  };
}

export function isWorkflowPageRecommendationRunRunning(recommendationSyncState) {
  return recommendationSyncState.recommendationRun?.status === "running";
}

export function renderWorkflowRecommendationConnectionInterrupted({
  elements,
  recommendationSyncState,
}) {
  const { recommendationRun } = recommendationSyncState;
  if (recommendationRun?.status !== "running") return false;

  elements.recommendationStatus.textContent =
    `running · 连接中断 · ${formatElapsed(recommendationRun.startedAt)}`;
  return true;
}
