import { prepareRecommendationExecution } from "./recommendation-execution-preparation.js";
import { runRecommendationCompletionSequence } from "./recommendation-completion-sequence.js";
import { buildCompletedRecommendationRun } from "./recommendation-run-completion-projection.js";
import { decideRecommendationRunStart } from "./recommendation-run-start-decision.js";

export async function startRecommendationFlow({
  id,
  tasks,
  startupCheck,
  recommendationPromptPath,
  existingTaskContextPackages = [],
  now = () => new Date().toISOString(),
}) {
  return decideRecommendationRunStart({
    id,
    tasks,
    startupCheck,
    recommendationPromptPath,
    existingTaskContextPackages,
    now,
  });
}

export async function completeRecommendationFlow({
  run,
  commandResult,
  tasks,
  startupCheck,
  projectProfile,
  existingTaskContextPackages = [],
  runMainAgentSession,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
  onProgress,
  signal,
}) {
  const preparation = await prepareRecommendationExecution({
    commandResult,
    tasks,
    startupCheck,
    projectProfile,
    existingTaskContextPackages,
    runMainAgentSession,
    repositoryDir,
    now,
  });
  const sequence = await runRecommendationCompletionSequence({
    preparation,
    projectProfile,
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    repositoryDir,
    now,
    onProgress,
    signal,
  });

  return buildCompletedRecommendationRun({
    run,
    commandResult,
    preparation,
    sequence,
    now,
  });
}
