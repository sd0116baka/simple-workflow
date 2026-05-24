import {
  requestRecommendationRunCancellation,
} from "./recommendation-run-state.js";
import { toRecommendationSnapshot } from "./recommendation-run-snapshot.js";

export function cancelRecommendationRunTransaction({
  recommendationRunLifecycleState,
  recommendationRunControllerRegistry,
  emitRecommendationChanged,
  progressRecorder = null,
  requestCancellation = requestRecommendationRunCancellation,
  snapshotRun = toRecommendationSnapshot,
}) {
  const cancellation = requestCancellation(recommendationRunLifecycleState.getLatestRun(), {
    appendCancellationProgress: progressRecorder?.appendCancellationProgress,
  });
  if (!cancellation.cancelled) {
    return {
      cancelled: false,
      error: cancellation.error,
      recommendationRun: snapshotRun(cancellation.run),
    };
  }

  recommendationRunLifecycleState.setLatestRun(cancellation.run);
  recommendationRunControllerRegistry.abort(cancellation.run.id);
  progressRecorder?.recordRunFinished(cancellation.run);
  emitRecommendationChanged(cancellation.run);
  return {
    cancelled: true,
    error: null,
    recommendationRun: snapshotRun(cancellation.run),
  };
}
