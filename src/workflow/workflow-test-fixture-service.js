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
  let fixtureOperationQueue = Promise.resolve();

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

  function runFixtureOperation(operation) {
    const queuedOperation = fixtureOperationQueue.then(operation, operation);
    fixtureOperationQueue = queuedOperation.catch(() => {});
    return queuedOperation;
  }

  return {
    async seedTestStateFixtures({ fixtureKey = "task-pool" } = {}) {
      return runFixtureOperation(async () => {
        const result = await seedTestStateFixtures({
          repositoryDir,
          tasksDir,
          storeDir,
          fixtureKey,
        });
        clearLatestRecommendationRun();
        emitFixtureChange("seed-test-state-fixtures");
        return result;
      });
    },

    async cleanupTestStateFixtures() {
      return runFixtureOperation(async () => {
        const result = await cleanupTestStateFixtures({
          repositoryDir,
          tasksDir,
          storeDir,
        });
        clearLatestRecommendationRun();
        emitFixtureChange("cleanup-test-state-fixtures");
        return result;
      });
    },
  };
}
