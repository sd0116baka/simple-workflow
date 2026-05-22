import { executeAutoMerge, planAutoMerge } from "./auto-merge-flow.js";
import {
  applyAutoMergeExecutionOutcome,
  applyAutoMergePlanningOutcome,
} from "./auto-merge-outcome-transition.js";
import { acceptConvergenceSuccess } from "./accept-convergence-decision.js";
import {
  acceptedAutoMergeResult,
  acceptanceFailureResult,
  closeoutFailureResult,
  executionFailureResult,
  executionIncompleteResult,
  planningFailureResult,
  planningIncompleteResult,
  replanAutoMergeResult,
  replanFailureResult,
} from "./auto-merge-action-result.js";
import { closeTask } from "./task-closeout-flow.js";
import { applyTaskCloseoutOutcome } from "./task-closeout-transition.js";

export async function acceptConvergenceAndRunAutoMerge({
  taskContextPackage,
  recommendationRun,
  repositoryDir,
  applyAppendRequest,
}) {
  const decision = acceptConvergenceSuccess({
    taskContextPackage,
    repositoryDir,
  });
  if (!decision.appendRequest) {
    recommendationRun.successHumanDecisionError = decision.error;
    return acceptanceFailureResult(decision.error);
  }

  await applyAppendRequest(decision.appendRequest, {
    currentWorkStage: "auto-merge-planning",
  });
  recommendationRun.successHumanDecisionError = null;

  const planning = planAutoMerge({
    taskContextPackage: recommendationRun.taskContextPackage,
    repositoryDir,
  });
  if (!planning.appendRequest) {
    recommendationRun.autoMergePlanningError = planning.error;
    return planningFailureResult(planning.error);
  }

  const planningOutcome = await applyAutoMergePlanningOutcome({
    recommendationRun,
    planning,
    applyAppendRequest,
  });
  if (!planningOutcome.planned) {
    return planningIncompleteResult();
  }

  const execution = executeAutoMerge({
    taskContextPackage: recommendationRun.taskContextPackage,
    repositoryDir,
  });
  if (!execution.appendRequest) {
    recommendationRun.autoMergeExecutionError = execution.error;
    return executionFailureResult(execution.error);
  }

  const executionOutcome = await applyAutoMergeExecutionOutcome({
    recommendationRun,
    execution,
    applyAppendRequest,
  });
  if (!executionOutcome.executed) {
    return executionIncompleteResult();
  }

  const closeout = closeTask({
    taskContextPackage: recommendationRun.taskContextPackage,
    repositoryDir,
  });
  if (!closeout.appendRequest) {
    recommendationRun.taskCloseoutError = closeout.error;
    return closeoutFailureResult(closeout.error);
  }

  const closeoutOutcome = await applyTaskCloseoutOutcome({
    recommendationRun,
    closeout,
    applyAppendRequest,
    defaultStage: "closed",
  });

  return acceptedAutoMergeResult({
    planningOutcome,
    executionOutcome,
    closeoutOutcome,
  });
}

export async function replanAcceptedAutoMerge({
  recommendationRun,
  repositoryDir,
  applyAppendRequest,
}) {
  const planning = planAutoMerge({
    taskContextPackage: {
      ...recommendationRun.taskContextPackage,
      currentWorkStage: "auto-merge-planning",
    },
    repositoryDir,
  });
  if (!planning.appendRequest) {
    recommendationRun.autoMergePlanningError = planning.error;
    return replanFailureResult(planning.error);
  }

  const planningOutcome = await applyAutoMergePlanningOutcome({
    recommendationRun,
    planning,
    applyAppendRequest,
  });
  recommendationRun.taskCloseoutError = null;

  return replanAutoMergeResult({ planningOutcome });
}
