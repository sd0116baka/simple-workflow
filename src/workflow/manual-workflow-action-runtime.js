export function createManualWorkflowActionRuntime({
  actionDefinitions,
  actionProtocol,
}) {
  function runAction(actionDefinition) {
    return actionProtocol.runManualWorkflowAction(actionDefinition);
  }

  return {
    async acceptConvergenceSuccess({ packageId = null } = {}) {
      return runAction(actionDefinitions.acceptConvergenceSuccess({ packageId }));
    },

    async replanAutoMerge({ packageId = null } = {}) {
      return runAction(actionDefinitions.replanAutoMerge({ packageId }));
    },

    async continueConvergenceWithGuidance({
      packageId = null,
      guidance = "",
      focusAreas = [],
      avoidRepeating = [],
      expectedNextOutcome = "",
    } = {}) {
      return runAction(
        actionDefinitions.continueConvergenceWithGuidance({
          packageId,
          guidance,
          focusAreas,
          avoidRepeating,
          expectedNextOutcome,
        }),
      );
    },

    async cancelTask({ packageId = null } = {}) {
      return runAction(actionDefinitions.cancelTask({ packageId }));
    },
  };
}
