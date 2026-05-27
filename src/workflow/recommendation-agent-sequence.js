import { requestHumanDecisionForTerminalConvergence } from "./convergence-human-decision-transition.js";
import {
  requestHumanDecisionForConvergenceFailure,
  requestHumanDecisionForConvergenceSuccess,
} from "./human-decision-request-flow.js";
import { runRecommendationAgentRounds } from "./recommendation-agent-rounds.js";
import {
  applyAppendRequest as applyAppendRequestToTaskPool,
  findTaskContextPackage,
} from "./task-pool.js";

export async function runRecommendationAgentSequence({
  taskPool,
  packageId,
  mainAgentInitialization,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  repositoryDir = process.cwd(),
  maxIterations = null,
  now = () => new Date().toISOString(),
  onProgress,
  applyAppendRequest = null,
  transitionCurrentWorkStage = null,
  signal,
  stageSwitches,
  runExecution,
  runReview,
  runConverge,
  requestSuccessHumanDecision = requestHumanDecisionForConvergenceSuccess,
  requestFailureHumanDecision = requestHumanDecisionForConvergenceFailure,
}) {
  const rounds = await runRecommendationAgentRounds({
    taskPool,
    packageId,
    mainAgentInitialization,
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    repositoryDir,
    maxIterations,
    now,
    onProgress,
    applyAppendRequest,
    transitionCurrentWorkStage,
    signal,
    stageSwitches,
    runExecution,
    runReview,
    runConverge,
  });

  if (!rounds.terminalConvergenceRun) {
    return {
      taskPool: rounds.taskPool,
      taskContextPackage: rounds.taskContextPackage,
      executionAgentRuns: rounds.executionAgentRuns,
      reviewAgentRuns: rounds.reviewAgentRuns,
      convergenceRuns: rounds.convergenceRuns,
      successHumanDecisionRequest: null,
      failureHumanDecisionRequest: null,
    };
  }

  taskPool = rounds.taskPool;
  const humanDecisionTransition = await requestHumanDecisionForTerminalConvergence({
    taskContextPackage: rounds.taskContextPackage,
    convergenceRun: rounds.terminalConvergenceRun,
    now,
    requestSuccessHumanDecision,
    requestFailureHumanDecision,
    applyAppendRequest: async (appendRequest, { currentWorkStage }) => {
      taskPool = applyAppendRequest
        ? await applyAppendRequest(appendRequest, { currentWorkStage })
        : applyAppendRequestToTaskPool(taskPool, appendRequest, { currentWorkStage });
      return findTaskContextPackage(taskPool, packageId);
    },
  });

  return {
    taskPool,
    taskContextPackage: findTaskContextPackage(taskPool, packageId),
    executionAgentRuns: rounds.executionAgentRuns,
    reviewAgentRuns: rounds.reviewAgentRuns,
    convergenceRuns: rounds.convergenceRuns,
    successHumanDecisionRequest: humanDecisionTransition.successHumanDecisionRequest,
    failureHumanDecisionRequest: humanDecisionTransition.failureHumanDecisionRequest,
  };
}
