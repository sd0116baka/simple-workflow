import { closeCancelledTask } from "./task-closeout-flow.js";
import { applyAppendRequest as defaultPreviewAppendRequest } from "./task-pool.js";

export function taskCloseoutOutcomeStage(closeout, defaultStage = "closed") {
  return closeout?.appendRequest?.artifact?.finalStage ?? defaultStage;
}

export async function applyTaskCloseoutOutcome({
  recommendationRun,
  closeout,
  applyAppendRequest,
  defaultStage = "closed",
} = {}) {
  if (!closeout?.appendRequest) {
    throw new Error("closeout.appendRequest is required");
  }

  const currentWorkStage = taskCloseoutOutcomeStage(closeout, defaultStage);
  await applyAppendRequest(closeout.appendRequest, { currentWorkStage });
  recommendationRun.taskCloseout = closeout;
  recommendationRun.taskCloseoutError = null;
  return {
    closed: true,
    currentWorkStage,
  };
}

export function previewPackageAfterCloseoutDecision({
  taskContextPackage,
  decisionAppendRequest,
  previewAppendRequest = defaultPreviewAppendRequest,
} = {}) {
  const previewPool = previewAppendRequest({
    taskContextPackages: [taskContextPackage],
  }, decisionAppendRequest, {
    currentWorkStage: "task-closeout",
  });
  return previewPool.taskContextPackages[0];
}

export async function applyCancelledTaskCloseoutTransition({
  taskContextPackage,
  recommendationRun,
  cancellation,
  repositoryDir,
  applyAppendRequest,
  closeCancelled = closeCancelledTask,
  previewAppendRequest = defaultPreviewAppendRequest,
} = {}) {
  if (!cancellation?.appendRequest) {
    throw new Error("cancellation.appendRequest is required");
  }

  const taskContextPackageWithDecision = previewPackageAfterCloseoutDecision({
    taskContextPackage,
    decisionAppendRequest: cancellation.appendRequest,
    previewAppendRequest,
  });
  const closeout = closeCancelled({
    taskContextPackage: taskContextPackageWithDecision,
    repositoryDir,
  });
  if (!closeout.appendRequest) {
    recommendationRun.taskCloseoutError = closeout.error;
    return {
      cancelled: false,
      closeout,
      error: closeout.error,
    };
  }

  await applyAppendRequest(cancellation.appendRequest, {
    currentWorkStage: "task-closeout",
  });
  recommendationRun.taskCancellation = cancellation;
  recommendationRun.taskCancellationError = null;

  await applyTaskCloseoutOutcome({
    recommendationRun,
    closeout,
    applyAppendRequest,
    defaultStage: "cancelled",
  });

  return {
    cancelled: true,
    closeout,
    error: null,
  };
}
