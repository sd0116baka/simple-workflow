import { appendRecommendationRunProgress } from "./recommendation-run-progress.js";
import { toRecommendationSnapshot } from "./recommendation-run-snapshot.js";

export function startRecommendationRunCommand({
  run,
  runRecommendationCommand,
  recommendationRunControllerRegistry,
  recommendationRunCompletion,
  emitRecommendationChanged,
}) {
  const appendProgress = (progress) => {
    appendRecommendationRunProgress(run, progress);
    emitRecommendationChanged(run);
  };
  const controller = recommendationRunControllerRegistry.create(run.id);
  const startedCommand = Promise.resolve().then(() =>
    runRecommendationCommand({
      prompt: run.prompt,
      run: toRecommendationSnapshot(run),
      onProgress: appendProgress,
      onTerminalSession: (terminalSession) => {
        run.terminalSessionId = terminalSession?.id ?? null;
        emitRecommendationChanged(run);
      },
      signal: controller.signal,
    }),
  );
  recommendationRunCompletion.finishRecommendationRun(run, startedCommand, appendProgress);
  return toRecommendationSnapshot(run);
}
