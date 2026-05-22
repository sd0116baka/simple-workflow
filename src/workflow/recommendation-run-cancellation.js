import {
  requestRecommendationRunCancellation,
} from "./recommendation-run-state.js";
import { toRecommendationSnapshot } from "./recommendation-run-snapshot.js";

export function cancelRecommendationRunTransaction({
  recommendationRunLifecycleState,
  recommendationRunControllerRegistry,
  emitRecommendationChanged,
  requestCancellation = requestRecommendationRunCancellation,
  snapshotRun = toRecommendationSnapshot,
}) {
  const cancellation = requestCancellation(recommendationRunLifecycleState.getLatestRun());
  if (!cancellation.cancelled) {
    return {
      cancelled: false,
      error: cancellation.error,
      recommendationRun: snapshotRun(cancellation.run),
    };
  }

  recommendationRunLifecycleState.setLatestRun(cancellation.run);
  recommendationRunControllerRegistry.abort(cancellation.run.id);
  emitRecommendationChanged(cancellation.run);
  return {
    cancelled: true,
    error: null,
    recommendationRun: snapshotRun(cancellation.run),
  };
}
