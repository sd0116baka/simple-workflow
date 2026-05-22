import { prepareRecommendationExecution } from "./recommendation-execution-preparation.js";
import { runRecommendationCompletionSequence } from "./recommendation-completion-sequence.js";
import { createSkippedRecommendationSequence } from "./recommendation-completion-sequence-shape.js";
import { buildCompletedRecommendationRun } from "./recommendation-run-completion-projection.js";
import { decideRecommendationRunStart } from "./recommendation-run-start-decision.js";

export async function startRecommendationFlow({
  id,
  mode = "workflow",
  stageSwitches,
  tasks,
  startupCheck,
  recommendationPromptPath,
  existingTaskContextPackages = [],
  now = () => new Date().toISOString(),
}) {
  return decideRecommendationRunStart({
    id,
    mode,
    stageSwitches,
    tasks,
    startupCheck,
    recommendationPromptPath,
    existingTaskContextPackages,
    now,
  });
}

export async function completeRecommendationFlow({
  run,
  mode = run?.mode ?? "workflow",
  stageSwitches = run?.stageSwitches,
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
    stageSwitches,
    repositoryDir,
    now,
    prepareDownstream: mode !== "probe",
  });
  const sequence = mode === "probe"
    ? createSkippedRecommendationSequence(preparation.taskPool)
    : await runRecommendationCompletionSequence({
        preparation,
        projectProfile,
        runExecutionAgentSession,
        runReviewAgentSession,
        runConvergenceSession,
        stageSwitches,
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
