import { runConvergence } from "./convergence-flow.js";
import { runExecutionAgent } from "./execution-agent-flow.js";
import { runReviewAgent } from "./review-agent-flow.js";
import { artifactRecord, latestArtifactRecord } from "./task-package-artifacts.js";
import { isWorkflowStageEnabled } from "./workflow-stage-switches.js";

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
  transitionCurrentWorkStage,
  runExecution = runExecutionAgent,
  runReview = runReviewAgent,
  runConverge = runConvergence,
  stageSwitches,
} = {}) {
  let currentPackage = taskContextPackage;

  if (!currentPackage) {
    return {
      taskContextPackage: currentPackage,
      executionAgentRun: null,
      reviewAgentRun: null,
      convergenceRun: null,
    };
  }

  const startsNewCorrectionCycle = Boolean(
    latestArtifactRecord(currentPackage, "convergenceAdvice")
      ?? latestArtifactRecord(currentPackage, "humanConvergenceGuidance"),
  );
  const hasExecutionReport = !startsNewCorrectionCycle
    && Boolean(latestArtifactRecord(currentPackage, "executionReport"));
  if (!hasExecutionReport && !isWorkflowStageEnabled(stageSwitches, "executionAgent")) {
    return {
      taskContextPackage: currentPackage,
      executionAgentRun: null,
      reviewAgentRun: null,
      convergenceRun: null,
    };
  }

  const executionAgentRun = hasExecutionReport
    ? null
    : await (async () => {
        currentPackage = await transitionCurrentWorkStage?.("execution-agent") ?? currentPackage;
        return runExecution({
          taskContextPackage: currentPackage,
          runAgentSession: runExecutionAgentSession,
          repositoryDir,
          now,
          onProgress,
          signal,
        });
      })();
  currentPackage = await applyRoundAppend({
    appendRequest: executionAgentRun?.appendRequest,
    currentWorkStage: "execution-agent",
    currentPackage,
    applyAppendRequest,
  });
  const executionReportReady = Boolean(
    latestArtifactRecord(currentPackage, "executionReport")
      ?? executionAgentRun?.appendRequest,
  );
  if (!executionReportReady || executionAgentRun?.error) {
    return {
      taskContextPackage: currentPackage,
      executionAgentRun,
      reviewAgentRun: null,
      convergenceRun: null,
    };
  }

  const hasReviewReport = !startsNewCorrectionCycle
    && !executionAgentRun?.appendRequest
    && Boolean(latestArtifactRecord(currentPackage, "reviewReport"));
  if (!hasReviewReport && !isWorkflowStageEnabled(stageSwitches, "reviewAgent")) {
    return {
      taskContextPackage: currentPackage,
      executionAgentRun,
      reviewAgentRun: null,
      convergenceRun: null,
    };
  }

  const reviewAgentRun = hasReviewReport
    ? null
    : await (async () => {
        currentPackage = await transitionCurrentWorkStage?.("review-agent") ?? currentPackage;
        return runReview({
          taskContextPackage: currentPackage,
          runAgentSession: runReviewAgentSession,
          repositoryDir,
          now,
          onProgress,
          signal,
        });
      })();
  currentPackage = await applyRoundAppend({
    appendRequest: reviewAgentRun?.appendRequest,
    currentWorkStage: "review-agent",
    currentPackage,
    applyAppendRequest,
  });
  const reviewReportReady = Boolean(
    latestArtifactRecord(currentPackage, "reviewReport")
      ?? reviewAgentRun?.appendRequest,
  );
  if (!reviewReportReady || reviewAgentRun?.error) {
    return {
      taskContextPackage: currentPackage,
      executionAgentRun,
      reviewAgentRun,
      convergenceRun: null,
    };
  }

  const hasConvergenceResult = Boolean(
    artifactRecord(currentPackage, "convergenceSuccess")
      ?? latestArtifactRecord(currentPackage, "convergenceFailure"),
  ) && !reviewAgentRun?.appendRequest;
  if (!hasConvergenceResult && !isWorkflowStageEnabled(stageSwitches, "convergence")) {
    return {
      taskContextPackage: currentPackage,
      executionAgentRun,
      reviewAgentRun,
      convergenceRun: null,
    };
  }

  const convergenceRun = hasConvergenceResult
    ? null
    : await (async () => {
        currentPackage = await transitionCurrentWorkStage?.("convergence") ?? currentPackage;
        return runConverge({
          taskContextPackage: currentPackage,
          runAgentSession: runConvergenceSession,
          repositoryDir,
          maxIterations,
          now,
          onProgress,
          signal,
        });
      })();
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
