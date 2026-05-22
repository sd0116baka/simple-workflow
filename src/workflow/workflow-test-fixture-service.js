import {
  cleanupTestStateFixtures as cleanupStateFixtures,
  seedTestStateFixtures as seedStateFixtures,
} from "./state-fixtures.js";

const STUB_STATE_FIXTURES_FILE = "stub-state-fixtures";

export function createWorkflowTestFixtureService({
  repositoryDir,
  tasksDir,
  storeDir,
  recommendationRunLifecycle,
  emitTaskChange,
  now = () => new Date().toISOString(),
  seedTestStateFixtures = seedStateFixtures,
  cleanupTestStateFixtures = cleanupStateFixtures,
}) {
  function clearLatestRecommendationRun() {
    recommendationRunLifecycle.setLatestRecommendationRun(null);
  }

  function emitFixtureChange(eventType) {
    emitTaskChange({
      eventType,
      fileName: STUB_STATE_FIXTURES_FILE,
      timestamp: now(),
    });
  }

  return {
    async seedTestStateFixtures({ fixtureKey = "task-pool" } = {}) {
      const result = await seedTestStateFixtures({
        repositoryDir,
        tasksDir,
        storeDir,
        fixtureKey,
      });
      clearLatestRecommendationRun();
      emitFixtureChange("seed-test-state-fixtures");
      return result;
    },

    async cleanupTestStateFixtures() {
      const result = await cleanupTestStateFixtures({
        repositoryDir,
        tasksDir,
        storeDir,
      });
      clearLatestRecommendationRun();
      emitFixtureChange("cleanup-test-state-fixtures");
      return result;
    },
  };
}
