function isCancelled(run) {
  return run?.status === "cancelled";
}

export async function applyCompletedRecommendationRun({
  run,
  completedRun,
  persistTaskContextPackage,
}) {
  if (isCancelled(run)) {
    return { applied: false };
  }

  Object.assign(run, completedRun);
  await persistTaskContextPackage(run.taskContextPackage);
  return { applied: true };
}

export function applyFailedRecommendationRun({
  run,
  error,
  now = () => new Date().toISOString(),
}) {
  if (isCancelled(run)) {
    return { applied: false };
  }

  Object.assign(run, {
    status: "failed",
    finishedAt: now(),
    error: error.message,
  });
  return { applied: true };
}
