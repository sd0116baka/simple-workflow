export function createManualWorkflowActionTargets({
  taskContextWorkspace,
  getLatestRecommendationRun,
}) {
  function selectorOptions(packageId) {
    return {
      latestRecommendationRun: getLatestRecommendationRun(),
      packageId,
    };
  }

  return {
    findAcceptableTaskContextPackage(packageId) {
      return taskContextWorkspace.findAcceptableTaskContextPackage(selectorOptions(packageId));
    },

    findAutoMergePlannablePackage(packageId) {
      return taskContextWorkspace.findAutoMergePlannablePackage(selectorOptions(packageId));
    },

    findGuidableConvergenceDecisionPackage(packageId) {
      return taskContextWorkspace.findGuidableConvergenceDecisionPackage(selectorOptions(packageId));
    },

    findCancellableHumanDecisionPackage(packageId) {
      return taskContextWorkspace.findCancellableHumanDecisionPackage(selectorOptions(packageId));
    },
  };
}
