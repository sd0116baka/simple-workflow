import { runRecommendationAgentSequence as runAgentSequence } from "./recommendation-agent-sequence.js";
import { createSkippedRecommendationSequence } from "./recommendation-completion-sequence-shape.js";

export async function runRecommendationCompletionSequence({
  preparation,
  projectProfile,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
  onProgress,
  signal,
  runRecommendationAgentSequence = runAgentSequence,
}) {
  if (preparation.commandFailed || !preparation.parsed.appendRequest) {
    return createSkippedRecommendationSequence(preparation.taskPool);
  }

  return runRecommendationAgentSequence({
    taskPool: preparation.taskPool,
    packageId: preparation.packageId,
    mainAgentInitialization: preparation.mainAgentInitialization,
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    repositoryDir,
    maxIterations: projectProfile?.defaults?.maxIterations ?? null,
    now,
    onProgress,
    signal,
  });
}
