export function createSkippedRecommendationSequence(taskPool) {
  return {
    taskPool,
    taskContextPackage: null,
    executionAgentRuns: [],
    reviewAgentRuns: [],
    convergenceRuns: [],
    successHumanDecisionRequest: null,
    failureHumanDecisionRequest: null,
  };
}
