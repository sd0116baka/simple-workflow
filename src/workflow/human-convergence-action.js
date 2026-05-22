import { runHumanConvergenceCorrectionRound } from "./human-convergence-correction-round.js";
import { provideHumanConvergenceGuidance } from "./human-convergence-guidance-decision.js";

export async function continueConvergenceWithHumanGuidance({
  taskContextPackage,
  recommendationRun,
  guidance = "",
  focusAreas = [],
  avoidRepeating = [],
  expectedNextOutcome = "",
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  repositoryDir,
  applyAppendRequest,
  maxIterations = 3,
  runExecution,
  runReview,
  runConverge,
  requestSuccessHumanDecision,
  requestFailureHumanDecision,
}) {
  const guidanceResult = provideHumanConvergenceGuidance({
    taskContextPackage,
    guidance,
    focusAreas,
    avoidRepeating,
    expectedNextOutcome,
  });
  if (!guidanceResult.appendRequest) {
    recommendationRun.humanConvergenceGuidanceError = guidanceResult.error;
    return {
      shouldEmit: true,
      response: {
        continued: false,
        error: guidanceResult.error,
      },
    };
  }

  await applyAppendRequest(guidanceResult.appendRequest, {
    currentWorkStage: "execution-agent",
  });
  recommendationRun.humanConvergenceGuidance = guidanceResult;
  recommendationRun.humanConvergenceGuidanceError = null;

  const round = await runHumanConvergenceCorrectionRound({
    recommendationRun,
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    repositoryDir,
    applyAppendRequest,
    maxIterations,
    runExecution,
    runReview,
    runConverge,
    requestSuccessHumanDecision,
    requestFailureHumanDecision,
  });
  const error = round.execution?.error
    ?? round.review?.error
    ?? round.convergence?.error
    ?? null;

  return {
    shouldEmit: true,
    response: {
      continued: !error,
      error,
    },
  };
}
