import { runAgentCorrectionRound } from "./agent-correction-round.js";
import {
  applyAppendRequest as applyAppendRequestToTaskPool,
  findTaskContextPackage,
  transitionTaskContextPackageStage,
} from "./task-pool.js";
import { multiArtifactRecords } from "./task-package-artifacts.js";

const MAIN_AGENT_INITIALIZATION_RUN_ID = "main-agent:initialization";

function collectRoundRuns(rounds) {
  return {
    executionAgentRuns: rounds.map((round) => round.executionAgentRun).filter(Boolean),
    reviewAgentRuns: rounds.map((round) => round.reviewAgentRun).filter(Boolean),
    convergenceRuns: rounds.map((round) => round.convergenceRun).filter(Boolean),
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

function hasMainAgentInitialization({ taskPool, packageId, mainAgentInitialization }) {
  if (mainAgentInitialization?.appendRequest) {
    return mainAgentInitialization.appendRequest.agentRun?.status === "succeeded";
  }
  const taskContextPackage = findTaskContextPackage(taskPool, packageId);
  return taskContextPackage?.agentRuns?.some((agentRun) =>
    agentRun.runId === MAIN_AGENT_INITIALIZATION_RUN_ID
      && agentRun.status === "succeeded") === true;
}

function isTerminalConvergenceRun(round) {
  return [
    "convergenceSuccess",
    "convergenceFailure",
  ].includes(round?.convergenceRun?.appendRequest?.artifactType);
}

function existingAdviceCount(taskPool, packageId) {
  return multiArtifactRecords(
    findTaskContextPackage(taskPool, packageId),
    "convergenceAdvice",
  ).length;
}

function remainingRoundLimit({ taskPool, packageId, maxIterations }) {
  if (!Number.isInteger(maxIterations)) return 2;
  return Math.max(maxIterations + 1 - existingAdviceCount(taskPool, packageId), 1);
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
  applyAppendRequest = null,
  transitionCurrentWorkStage = null,
  runExecution,
  runReview,
  runConverge,
  runCorrectionRound = runAgentCorrectionRound,
}) {
  if (!taskPool || !packageId || !hasMainAgentInitialization({
    taskPool,
    packageId,
    mainAgentInitialization,
  })) {
    return emptyRoundSequence(taskPool, packageId);
  }

  let currentTaskPool = taskPool;
  async function transitionStage(currentWorkStage) {
    if (!currentWorkStage) return findTaskContextPackage(currentTaskPool, packageId);
    currentTaskPool = transitionCurrentWorkStage
      ? await transitionCurrentWorkStage(packageId, { currentWorkStage })
      : transitionTaskContextPackageStage(currentTaskPool, packageId, { currentWorkStage });
    return findTaskContextPackage(currentTaskPool, packageId);
  }

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
      transitionCurrentWorkStage: transitionStage,
      applyAppendRequest: async (appendRequest, { currentWorkStage }) => {
        currentTaskPool = applyAppendRequest
          ? await applyAppendRequest(appendRequest, { currentWorkStage })
          : applyAppendRequestToTaskPool(currentTaskPool, appendRequest, { currentWorkStage });
        return findTaskContextPackage(currentTaskPool, packageId);
      },
    });

  const rounds = [];
  const roundLimit = remainingRoundLimit({ taskPool: currentTaskPool, packageId, maxIterations });
  for (let roundIndex = 0; roundIndex < roundLimit; roundIndex += 1) {
    const round = await runRound();
    rounds.push(round);
    const artifactType = round.convergenceRun?.appendRequest?.artifactType;
    if (artifactType !== "convergenceAdvice") break;
  }

  const roundRuns = collectRoundRuns(rounds);
  const terminalRound = rounds.findLast(isTerminalConvergenceRun);
  return {
    taskPool: currentTaskPool,
    taskContextPackage: findTaskContextPackage(currentTaskPool, packageId),
    ...roundRuns,
    terminalConvergenceRun: terminalRound?.convergenceRun ?? null,
  };
}
