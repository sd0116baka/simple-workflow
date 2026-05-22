import {
  requestHumanDecisionForConvergenceFailure,
  requestHumanDecisionForConvergenceSuccess,
} from "./human-decision-request-flow.js";

export async function requestHumanDecisionForTerminalConvergence({
  taskContextPackage,
  convergenceRun,
  now,
  applyAppendRequest,
  requestSuccessHumanDecision = requestHumanDecisionForConvergenceSuccess,
  requestFailureHumanDecision = requestHumanDecisionForConvergenceFailure,
} = {}) {
  const artifactType = convergenceRun?.appendRequest?.artifactType;
  const successHumanDecisionRequest =
    !taskContextPackage || artifactType !== "convergenceSuccess"
      ? null
      : requestSuccessHumanDecision({
          taskContextPackage,
          now,
        });
  const failureHumanDecisionRequest =
    !taskContextPackage || artifactType !== "convergenceFailure"
      ? null
      : requestFailureHumanDecision({
          taskContextPackage,
          now,
        });
  const humanDecisionRequest = successHumanDecisionRequest ?? failureHumanDecisionRequest;
  const nextTaskContextPackage = !humanDecisionRequest?.appendRequest
    ? taskContextPackage
    : await applyAppendRequest(humanDecisionRequest.appendRequest, {
        currentWorkStage: "human-decision",
      });

  return {
    taskContextPackage: nextTaskContextPackage ?? taskContextPackage,
    successHumanDecisionRequest,
    failureHumanDecisionRequest,
  };
}
