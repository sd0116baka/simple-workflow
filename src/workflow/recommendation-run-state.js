import { createEmptyRecommendationRunFields } from "./recommendation-run-field-defaults.js";
import { appendRecommendationRunCancellationProgress } from "./recommendation-run-progress.js";

export function createManualWorkflowActionRun({
  taskContextPackage = null,
  now = () => new Date().toISOString(),
} = {}) {
  const timestamp = now();
  return {
    id: "manual-workflow-action",
    status: "succeeded",
    startedAt: timestamp,
    finishedAt: timestamp,
    command: null,
    args: [],
    startupCheck: null,
    ...createEmptyRecommendationRunFields(),
    taskContextPackage,
  };
}

export function ensureManualWorkflowActionRun(currentRun, {
  taskContextPackage,
  now,
} = {}) {
  const run = !currentRun || currentRun.status === "running"
    ? createManualWorkflowActionRun({ taskContextPackage, now })
    : currentRun;
  run.executionAgentRuns ??= [];
  run.executionAgentErrors ??= [];
  run.reviewAgentRuns ??= [];
  run.reviewAgentErrors ??= [];
  run.convergenceRuns ??= [];
  run.convergenceErrors ??= [];
  run.taskContextPackage = taskContextPackage;
  return run;
}

export function requestRecommendationRunCancellation(run, {
  now = () => new Date().toISOString(),
} = {}) {
  if (!run || run.status !== "running") {
    return {
      cancelled: false,
      error: "没有正在运行的推荐器流程。",
      run,
    };
  }
  run.status = "cancelled";
  run.finishedAt = now();
  run.error = "cancelled";
  appendRecommendationRunCancellationProgress(run, { now });
  return {
    cancelled: true,
    error: null,
    run,
  };
}
