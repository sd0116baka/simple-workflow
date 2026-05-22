import { runConvergence } from "./convergence-flow.js";
import { runExecutionAgent } from "./execution-agent-flow.js";
import { runReviewAgent } from "./review-agent-flow.js";

async function applyRoundAppend({
  appendRequest,
  currentWorkStage,
  currentPackage,
  applyAppendRequest,
}) {
  if (!appendRequest) return currentPackage;
  const nextPackage = await applyAppendRequest(appendRequest, { currentWorkStage });
  return nextPackage ?? currentPackage;
}

export async function runAgentCorrectionRound({
  taskContextPackage,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  repositoryDir = process.cwd(),
  maxIterations = null,
  now = () => new Date().toISOString(),
  onProgress,
  signal,
  applyAppendRequest,
  runExecution = runExecutionAgent,
  runReview = runReviewAgent,
  runConverge = runConvergence,
} = {}) {
  let currentPackage = taskContextPackage;

  const executionAgentRun = !currentPackage
    ? null
    : await runExecution({
        taskContextPackage: currentPackage,
        runAgentSession: runExecutionAgentSession,
        repositoryDir,
        now,
        onProgress,
        signal,
      });
  currentPackage = await applyRoundAppend({
    appendRequest: executionAgentRun?.appendRequest,
    currentWorkStage: "execution-agent",
    currentPackage,
    applyAppendRequest,
  });
  if (!executionAgentRun?.appendRequest || executionAgentRun.error) {
    return {
      taskContextPackage: currentPackage,
      executionAgentRun,
      reviewAgentRun: null,
      convergenceRun: null,
    };
  }

  const reviewAgentRun = !currentPackage
    ? null
    : await runReview({
        taskContextPackage: currentPackage,
        runAgentSession: runReviewAgentSession,
        repositoryDir,
        now,
      });
  currentPackage = await applyRoundAppend({
    appendRequest: reviewAgentRun?.appendRequest,
    currentWorkStage: "review-agent",
    currentPackage,
    applyAppendRequest,
  });
  if (!reviewAgentRun?.appendRequest) {
    return {
      taskContextPackage: currentPackage,
      executionAgentRun,
      reviewAgentRun,
      convergenceRun: null,
    };
  }

  const convergenceRun = !currentPackage
    ? null
    : await runConverge({
        taskContextPackage: currentPackage,
        runAgentSession: runConvergenceSession,
        repositoryDir,
        maxIterations,
        now,
        onProgress,
        signal,
      });
  currentPackage = await applyRoundAppend({
    appendRequest: convergenceRun?.appendRequest,
    currentWorkStage: "convergence",
    currentPackage,
    applyAppendRequest,
  });

  return {
    taskContextPackage: currentPackage,
    executionAgentRun,
    reviewAgentRun,
    convergenceRun,
  };
}
