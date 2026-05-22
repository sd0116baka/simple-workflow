import { projectRecommendationPreparationFields } from "./recommendation-run-preparation-projection.js";
import { projectRecommendationSequenceFields } from "./recommendation-run-sequence-projection.js";

function projectRecommendationCommandResultFields(commandResult, run) {
  return {
    stdout: commandResult.stdout ?? "",
    stderr: commandResult.stderr ?? "",
    exitCode: commandResult.exitCode ?? null,
    error: commandResult.error ?? null,
    terminalSessionId: commandResult.terminalSessionId ?? run.terminalSessionId ?? null,
  };
}

export function buildCompletedRecommendationRun({
  run,
  commandResult,
  preparation,
  sequence,
  now = () => new Date().toISOString(),
}) {
  const commandResultFields = projectRecommendationCommandResultFields(commandResult, run);
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
