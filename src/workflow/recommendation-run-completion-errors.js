function errorsFrom(agentRuns) {
  return agentRuns
    .map((agentRun) => agentRun.error)
    .filter(Boolean);
}

export function collectRecommendationCompletionErrors(sequence) {
  return {
    executionAgentErrors: errorsFrom(sequence.executionAgentRuns),
    reviewAgentErrors: errorsFrom(sequence.reviewAgentRuns),
    convergenceErrors: errorsFrom(sequence.convergenceRuns),
    successHumanDecisionError: sequence.successHumanDecisionRequest?.error ?? null,
    failureHumanDecisionError: sequence.failureHumanDecisionRequest?.error ?? null,
  };
}
