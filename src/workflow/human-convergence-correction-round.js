import { runAgentCorrectionRound } from "./agent-correction-round.js";
import { runExecutionAgent } from "./execution-agent-flow.js";
import { runConvergence } from "./convergence-flow.js";
import { requestHumanDecisionForTerminalConvergence } from "./convergence-human-decision-transition.js";
import { runReviewAgent } from "./review-agent-flow.js";
import {
  requestHumanDecisionForConvergenceFailure,
  requestHumanDecisionForConvergenceSuccess,
} from "./human-decision-request-flow.js";

function recordAgentRun(recommendationRun, {
  run,
  runsField,
  errorsField,
}) {
  if (!run) return;

  recommendationRun[runsField].push(run);
  recommendationRun[errorsField] = [
    ...recommendationRun[errorsField],
    run.error,
  ].filter(Boolean);
}

function createRecommendationRunAppendAdapter({
  recommendationRun,
  applyAppendRequest,
}) {
  return async (appendRequest, { currentWorkStage }) => {
    await applyAppendRequest(appendRequest, { currentWorkStage });
    return recommendationRun.taskContextPackage;
  };
}

function recordTerminalHumanDecisionTransition(recommendationRun, transition) {
  if (transition.successHumanDecisionRequest) {
    recommendationRun.successHumanDecisionRequest = transition.successHumanDecisionRequest;
    recommendationRun.successHumanDecisionError = transition.successHumanDecisionRequest.error ?? null;
  }
  if (transition.failureHumanDecisionRequest) {
    recommendationRun.failureHumanDecisionRequest = transition.failureHumanDecisionRequest;
    recommendationRun.failureHumanDecisionError = transition.failureHumanDecisionRequest.error ?? null;
  }
}

export async function runHumanConvergenceCorrectionRound({
  recommendationRun,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  repositoryDir,
  applyAppendRequest,
  maxIterations = 3,
  runCorrectionRound = runAgentCorrectionRound,
  runExecution = runExecutionAgent,
  runReview = runReviewAgent,
  runConverge = runConvergence,
  requestTerminalHumanDecision = requestHumanDecisionForTerminalConvergence,
  requestSuccessHumanDecision = requestHumanDecisionForConvergenceSuccess,
  requestFailureHumanDecision = requestHumanDecisionForConvergenceFailure,
}) {
  const appendAndRefreshPackage = createRecommendationRunAppendAdapter({
    recommendationRun,
    applyAppendRequest,
  });
  const round = await runCorrectionRound({
    taskContextPackage: recommendationRun.taskContextPackage,
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    repositoryDir,
    maxIterations,
    runExecution,
    runReview,
    runConverge,
    applyAppendRequest: appendAndRefreshPackage,
  });
  const {
    executionAgentRun: execution,
    reviewAgentRun: review,
    convergenceRun: convergence,
  } = round;

  recordAgentRun(recommendationRun, {
    run: execution,
    runsField: "executionAgentRuns",
    errorsField: "executionAgentErrors",
  });
  if (!execution?.appendRequest || execution.error) {
    return { execution, review: null, convergence: null };
  }

  recordAgentRun(recommendationRun, {
    run: review,
    runsField: "reviewAgentRuns",
    errorsField: "reviewAgentErrors",
  });
  if (!review?.appendRequest) {
    return { execution, review, convergence: null };
  }

  recordAgentRun(recommendationRun, {
    run: convergence,
    runsField: "convergenceRuns",
    errorsField: "convergenceErrors",
  });
  if (!convergence?.appendRequest) return { execution, review, convergence };

  const transition = await requestTerminalHumanDecision({
    taskContextPackage: recommendationRun.taskContextPackage,
    convergenceRun: convergence,
    requestSuccessHumanDecision,
    requestFailureHumanDecision,
    applyAppendRequest: appendAndRefreshPackage,
  });
  recordTerminalHumanDecisionTransition(recommendationRun, transition);

  return { execution, review, convergence };
}
