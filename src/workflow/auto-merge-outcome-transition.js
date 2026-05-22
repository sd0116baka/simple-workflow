import { requestHumanDecisionForAutoMergeIssue } from "./human-decision-request-flow.js";

export function autoMergePlanningOutcomeStage(appendRequest) {
  return appendRequest?.artifactType === "autoMergePlan"
    ? "auto-merge-execution"
    : "auto-merge-planning";
}

export function autoMergeExecutionOutcomeStage(appendRequest) {
  return appendRequest?.artifactType === "autoMergeResult"
    ? "merged"
    : "auto-merge-execution";
}

async function requestHumanDecisionForLatestAutoMergeIssue({
  recommendationRun,
  artifactType,
  applyAppendRequest,
  requestHumanDecisionForIssue,
}) {
  const request = requestHumanDecisionForIssue({
    taskContextPackage: recommendationRun.taskContextPackage,
    artifactType,
  });
  recommendationRun.autoMergeHumanDecisionRequest = request;
  recommendationRun.autoMergeHumanDecisionError = request.error ?? null;
  if (request.appendRequest) {
    await applyAppendRequest(request.appendRequest, {
      currentWorkStage: "human-decision",
    });
  }
  return request;
}

export async function applyAutoMergePlanningOutcome({
  recommendationRun,
  planning,
  applyAppendRequest,
  requestHumanDecisionForIssue = requestHumanDecisionForAutoMergeIssue,
}) {
  if (!planning?.appendRequest) {
    throw new Error("planning.appendRequest is required");
  }

  await applyAppendRequest(planning.appendRequest, {
    currentWorkStage: autoMergePlanningOutcomeStage(planning.appendRequest),
  });
  recommendationRun.autoMergePlanning = planning;
  recommendationRun.autoMergePlanningError = null;

  const planned = planning.appendRequest.artifactType === "autoMergePlan";
  let humanDecisionRequest = null;
  if (!planned) {
    humanDecisionRequest = await requestHumanDecisionForLatestAutoMergeIssue({
      recommendationRun,
      artifactType: planning.appendRequest.artifactType,
      applyAppendRequest,
      requestHumanDecisionForIssue,
    });
  }

  return {
    planned,
    humanDecisionRequest,
  };
}

export async function applyAutoMergeExecutionOutcome({
  recommendationRun,
  execution,
  applyAppendRequest,
  requestHumanDecisionForIssue = requestHumanDecisionForAutoMergeIssue,
}) {
  if (!execution?.appendRequest) {
    throw new Error("execution.appendRequest is required");
  }

  await applyAppendRequest(execution.appendRequest, {
    currentWorkStage: autoMergeExecutionOutcomeStage(execution.appendRequest),
  });
  recommendationRun.autoMergeExecution = execution;
  recommendationRun.autoMergeExecutionError = null;

  const executed = execution.appendRequest.artifactType === "autoMergeResult";
  let humanDecisionRequest = null;
  if (!executed) {
    humanDecisionRequest = await requestHumanDecisionForLatestAutoMergeIssue({
      recommendationRun,
      artifactType: execution.appendRequest.artifactType,
      applyAppendRequest,
      requestHumanDecisionForIssue,
    });
  }

  return {
    executed,
    humanDecisionRequest,
  };
}
