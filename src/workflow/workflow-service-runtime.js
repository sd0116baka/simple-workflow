import { toRecommendationSnapshot as snapshotRecommendationRun } from "./recommendation-run-snapshot.js";

export function createWorkflowServiceRuntime({
  workflowReadModelService,
  workflowTestFixtureService,
  recommendationRunLifecycle,
  manualWorkflowActionService,
  workflowEventBus,
  taskSourceWatcher,
  toRecommendationSnapshot = snapshotRecommendationRun,
}) {
  return {
    listTasks() {
      return workflowReadModelService.listTasks();
    },

    async listTaskPool() {
      return workflowReadModelService.listTaskPool();
    },

    async getStartupCheck() {
      return workflowReadModelService.getStartupCheck();
    },

    async seedTestStateFixtures({ fixtureKey = "task-pool" } = {}) {
      return workflowTestFixtureService.seedTestStateFixtures({ fixtureKey });
    },

    async cleanupTestStateFixtures() {
      return workflowTestFixtureService.cleanupTestStateFixtures();
    },

    async createRecommendationRun() {
      return recommendationRunLifecycle.createRecommendationRun();
    },

    cancelRecommendationRun() {
      return recommendationRunLifecycle.cancelRecommendationRun();
    },

    getLatestRecommendationRun() {
      return toRecommendationSnapshot(recommendationRunLifecycle.getLatestRecommendationRun());
    },

    async acceptConvergenceSuccess({ packageId = null } = {}) {
      return manualWorkflowActionService.acceptConvergenceSuccess({ packageId });
    },

    async replanAutoMerge({ packageId = null } = {}) {
      return manualWorkflowActionService.replanAutoMerge({ packageId });
    },

    async continueConvergenceWithGuidance({
      packageId = null,
      guidance = "",
      focusAreas = [],
      avoidRepeating = [],
      expectedNextOutcome = "",
    } = {}) {
      return manualWorkflowActionService.continueConvergenceWithGuidance({
        packageId,
        guidance,
        focusAreas,
        avoidRepeating,
        expectedNextOutcome,
      });
    },

    async cancelTask({ packageId = null } = {}) {
      return manualWorkflowActionService.cancelTask({ packageId });
    },

    onEvent(listener) {
      return workflowEventBus.onEvent(listener);
    },

    async startWatching() {
      await taskSourceWatcher.start();
    },

    stopWatching() {
      taskSourceWatcher.stop();
      workflowEventBus.clear();
    },
  };
}
