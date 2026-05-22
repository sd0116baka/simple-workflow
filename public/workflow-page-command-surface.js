export function createWorkflowPageCommandSurface({
  autoMergeReplanCommand,
  fixtureCommands,
  manualActionCommands,
  recommendationRunCommands,
  refreshPage,
  restartCommand,
} = {}) {
  return {
    commandActions: {
      refreshPage,
      restartServer: restartCommand.restartServer,
      seedStateFixtures: fixtureCommands.seedStateFixtures,
      cleanupStateFixtures: fixtureCommands.cleanupStateFixtures,
      createRecommendationRun: recommendationRunCommands.createRecommendationRun,
      cancelRecommendationRun: recommendationRunCommands.cancelRecommendationRun,
      replanAutoMerge: autoMergeReplanCommand.replanAutoMerge,
    },
    pageCommands: {
      acceptConvergence: manualActionCommands.acceptConvergence,
      continueConvergenceWithGuidance: manualActionCommands.continueConvergenceWithGuidance,
      cancelTask: manualActionCommands.cancelTask,
      replanAutoMerge: autoMergeReplanCommand.replanAutoMerge,
      createRecommendationRun: recommendationRunCommands.createRecommendationRun,
      cancelRecommendationRun: recommendationRunCommands.cancelRecommendationRun,
      restartServer: restartCommand.restartServer,
      seedStateFixtures: fixtureCommands.seedStateFixtures,
      cleanupStateFixtures: fixtureCommands.cleanupStateFixtures,
      refreshPage,
    },
  };
}
