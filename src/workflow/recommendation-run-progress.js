const DEFAULT_PROGRESS_LIMIT = 200;

export function appendRecommendationRunProgress(run, progress, {
  now = () => new Date().toISOString(),
  limit = DEFAULT_PROGRESS_LIMIT,
} = {}) {
  run.progress.push({
    ...progress,
    timestamp: now(),
  });
  run.progress = run.progress.slice(-limit);
  return run.progress;
}

export function appendRecommendationRunCancellationProgress(run, options = {}) {
  return appendRecommendationRunProgress(
    run,
    {
      type: "cancel_requested",
      stream: "system",
      message: "用户请求取消运行",
      terminalLine: "process: cancellation requested by user",
    },
    options,
  );
}
