import { collectRecommendationCompletionErrors } from "./recommendation-run-completion-errors.js";

export function projectRecommendationSequenceFields(sequence) {
  const errors = collectRecommendationCompletionErrors(sequence);

  return {
    executionAgentRuns: sequence.executionAgentRuns,
    executionAgentErrors: errors.executionAgentErrors,
    reviewAgentRuns: sequence.reviewAgentRuns,
    reviewAgentErrors: errors.reviewAgentErrors,
    convergenceRuns: sequence.convergenceRuns,
    convergenceErrors: errors.convergenceErrors,
    successHumanDecisionRequest: sequence.successHumanDecisionRequest,
    successHumanDecisionError: errors.successHumanDecisionError,
    failureHumanDecisionRequest: sequence.failureHumanDecisionRequest,
    failureHumanDecisionError: errors.failureHumanDecisionError,
    taskContextPackage: sequence.taskContextPackage,
  };
}
