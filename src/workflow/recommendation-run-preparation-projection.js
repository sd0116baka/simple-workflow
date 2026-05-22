export function projectRecommendationPreparationFields(preparation) {
  return {
    executionIntent: preparation.parsed.intent,
    executionIntentAppendRequest: preparation.parsed.appendRequest,
    executionIntentError: preparation.parsed.error,
    executionAdmission: preparation.executionAdmission,
    isolatedWorkspaceAllocation: preparation.isolatedWorkspaceAllocation,
    isolatedWorkspaceError: preparation.isolatedWorkspaceAllocation?.error ?? null,
    mainAgentInitialization: preparation.mainAgentInitialization,
    mainAgentInitializationError: preparation.mainAgentInitialization?.error ?? null,
  };
}
