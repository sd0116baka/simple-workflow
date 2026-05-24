import { appendRecommendationRunProgress } from "./recommendation-run-progress.js";
import { toRecommendationSnapshot } from "./recommendation-run-snapshot.js";

export function startRecommendationRunCommand({
  run,
  runRecommendationCommand,
  recommendationRunControllerRegistry,
  recommendationRunCompletion,
  emitRecommendationChanged,
  progressRecorder = null,
}) {
  const appendProgress = (progress) => {
    if (progressRecorder) {
      progressRecorder.appendProgress(run, progress);
      return;
    }
    appendRecommendationRunProgress(run, progress);
    emitRecommendationChanged(run);
  };
  const controller = recommendationRunControllerRegistry.create(run.id);
  progressRecorder?.recordSystemEvent(run, {
    type: "recommendation_command_started",
    message: "推荐器命令开始执行。",
    command: run.command,
    args: run.args,
  });
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
