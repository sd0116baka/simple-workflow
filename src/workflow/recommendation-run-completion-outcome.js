import {
  completeTaskRecommenderState,
  failTaskRecommenderState,
} from "./module-status.js";

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

  Object.assign(run, {
    ...completedRun,
    taskRecommender: completeTaskRecommenderState({ run, completedRun }),
  });
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

  const finishedAt = now();
  Object.assign(run, {
    status: "failed",
    finishedAt,
    taskRecommender: failTaskRecommenderState({ run, error, finishedAt }),
    error: error.message,
  });
  return { applied: true };
}
