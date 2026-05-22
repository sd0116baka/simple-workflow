import { runAgentCorrectionRound } from "./agent-correction-round.js";
import { applyAppendRequest, findTaskContextPackage } from "./task-pool.js";

function collectRoundRuns(firstRound, secondRound) {
  return {
    executionAgentRuns: [
      firstRound.executionAgentRun,
      secondRound.executionAgentRun,
    ].filter(Boolean),
    reviewAgentRuns: [
      firstRound.reviewAgentRun,
      secondRound.reviewAgentRun,
    ].filter(Boolean),
    convergenceRuns: [
      firstRound.convergenceRun,
      secondRound.convergenceRun,
    ].filter(Boolean),
  };
}

function emptyRoundSequence(taskPool, packageId) {
  return {
    taskPool,
    taskContextPackage: packageId ? findTaskContextPackage(taskPool, packageId) : null,
    executionAgentRuns: [],
    reviewAgentRuns: [],
    convergenceRuns: [],
    terminalConvergenceRun: null,
  };
}

export async function runRecommendationAgentRounds({
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
  signal,
  stageSwitches,
  runExecution,
  runReview,
  runConverge,
  runCorrectionRound = runAgentCorrectionRound,
}) {
  if (!taskPool || !packageId || !mainAgentInitialization?.appendRequest) {
    return emptyRoundSequence(taskPool, packageId);
  }

  let currentTaskPool = taskPool;
  const runRound = async () =>
    runCorrectionRound({
      taskContextPackage: findTaskContextPackage(currentTaskPool, packageId),
      runExecutionAgentSession,
      runReviewAgentSession,
      runConvergenceSession,
      repositoryDir,
      maxIterations,
      now,
      onProgress,
      signal,
      stageSwitches,
      runExecution,
      runReview,
      runConverge,
      applyAppendRequest: (appendRequest, { currentWorkStage }) => {
        currentTaskPool = applyAppendRequest(currentTaskPool, appendRequest, { currentWorkStage });
        return findTaskContextPackage(currentTaskPool, packageId);
      },
    });

  const firstRound = await runRound();
  const shouldRunSecondRound =
    firstRound.convergenceRun?.appendRequest?.artifactType === "convergenceAdvice";
  const secondRound = shouldRunSecondRound
    ? await runRound()
    : {
        executionAgentRun: null,
        reviewAgentRun: null,
        convergenceRun: null,
      };

  const roundRuns = collectRoundRuns(firstRound, secondRound);
  return {
    taskPool: currentTaskPool,
    taskContextPackage: findTaskContextPackage(currentTaskPool, packageId),
    ...roundRuns,
    terminalConvergenceRun: secondRound.convergenceRun ?? firstRound.convergenceRun,
  };
}
