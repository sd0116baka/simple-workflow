export function createWorkflowPageErrorTargets(elements) {
  return {
    selectedTitle: elements.selectedTitle,
    selectedMeta: elements.selectedMeta,
    rawText: elements.rawText,
    parsedText: elements.parsedText,
    validationResult: elements.validationResult,
    startupCheckPanel: elements.startupCheckPanel,
    parseStatus: elements.parseStatus,
    validationStatus: elements.validationStatus,
    startupCheckStatus: elements.startupCheckStatus,
    recommendationStatus: elements.recommendationStatus,
    humanDecisionStatus: elements.humanDecisionStatus,
    recommendationResult: elements.recommendationResult,
    runRecommendationButton: elements.runRecommendationButton,
    seedStateFixturesButton: elements.seedStateFixturesButton,
    cleanupStateFixturesButton: elements.cleanupStateFixturesButton,
    cancelRecommendationButton: elements.cancelRecommendationButton,
  };
}

export function createWorkflowPageCommandTargets(elements) {
  return {
    restartButton: elements.restartButton,
    refreshButton: elements.refreshButton,
    seedStateFixtureSelect: elements.seedStateFixtureSelect,
    seedStateFixturesButton: elements.seedStateFixturesButton,
    cleanupStateFixturesButton: elements.cleanupStateFixturesButton,
    runRecommendationButton: elements.runRecommendationButton,
    cancelRecommendationButton: elements.cancelRecommendationButton,
    recommendationStatus: elements.recommendationStatus,
    recommendationResult: elements.recommendationResult,
    humanDecisionStatus: elements.humanDecisionStatus,
    autoMergeStatus: elements.autoMergeStatus,
  };
}
