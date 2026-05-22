import { cancelTaskAfterHumanDecisionRequest } from "./cancel-task-decision.js";
import { closeCancelledTask } from "./task-closeout-flow.js";
import { applyCancelledTaskCloseoutTransition } from "./task-closeout-transition.js";

export async function cancelTaskFromHumanDecision({
  taskContextPackage,
  recommendationRun,
  repositoryDir,
  applyAppendRequest,
  closeCancelled = closeCancelledTask,
}) {
  const cancellation = cancelTaskAfterHumanDecisionRequest({
    taskContextPackage,
    repositoryDir,
  });
  if (!cancellation.appendRequest) {
    recommendationRun.taskCancellationError = cancellation.error;
    return {
      shouldEmit: true,
      response: {
        cancelled: false,
        error: cancellation.error,
      },
    };
  }

  const closeoutOutcome = await applyCancelledTaskCloseoutTransition({
    taskContextPackage,
    recommendationRun,
    cancellation,
    repositoryDir,
    applyAppendRequest,
    closeCancelled,
  });
  if (!closeoutOutcome.cancelled) {
    return {
      shouldEmit: true,
      response: {
        cancelled: false,
        error: closeoutOutcome.error,
      },
    };
  }

  return {
    shouldEmit: true,
    response: {
      cancelled: true,
      error: null,
    },
  };
}
