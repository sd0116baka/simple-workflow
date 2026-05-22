import { projectRecommendationPreparationFields } from "./recommendation-run-preparation-projection.js";
import { projectRecommendationSequenceFields } from "./recommendation-run-sequence-projection.js";

function projectRecommendationCommandResultFields(commandResult) {
  return {
    stdout: commandResult.stdout ?? "",
    stderr: commandResult.stderr ?? "",
    exitCode: commandResult.exitCode ?? null,
    error: commandResult.error ?? null,
  };
}

export function buildCompletedRecommendationRun({
  run,
  commandResult,
  preparation,
  sequence,
  now = () => new Date().toISOString(),
}) {
  const commandResultFields = projectRecommendationCommandResultFields(commandResult);
  const preparationFields = projectRecommendationPreparationFields(preparation);
  const sequenceFields = projectRecommendationSequenceFields(sequence);

  return {
    ...run,
    status: preparation.commandFailed ? "failed" : "succeeded",
    finishedAt: now(),
    ...commandResultFields,
    ...preparationFields,
    ...sequenceFields,
  };
}
