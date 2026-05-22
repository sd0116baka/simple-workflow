import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowTestFixtureService } from "../src/workflow/workflow-test-fixture-service.js";

function createFixtureService({ seedResult = { count: 1 }, cleanupResult = { removedTaskFiles: 1 } } = {}) {
  const calls = {
    seed: [],
    cleanup: [],
    lifecycle: [],
    events: [],
  };
  const service = createWorkflowTestFixtureService({
    repositoryDir: "repo",
    tasksDir: "tasks",
    storeDir: "store",
    recommendationRunLifecycle: {
      setLatestRecommendationRun(run) {
        calls.lifecycle.push(run);
      },
    },
    emitTaskChange(event) {
      calls.events.push(event);
    },
    now: () => "2026-05-21T00:00:00.000Z",
    async seedTestStateFixtures(request) {
      calls.seed.push(request);
      return seedResult;
    },
    async cleanupTestStateFixtures(request) {
      calls.cleanup.push(request);
      return cleanupResult;
    },
  });
  return {
    calls,
    service,
  };
}

test("workflow test fixture service seeds fixtures and emits a task change", async () => {
  const { calls, service } = createFixtureService({
    seedResult: {
      generatedAt: "now",
      count: 1,
    },
  });

  const result = await service.seedTestStateFixtures({ fixtureKey: "human-guided-execution" });

  assert.deepEqual(result, {
    generatedAt: "now",
    count: 1,
  });
  assert.deepEqual(calls.seed, [
    {
      repositoryDir: "repo",
      tasksDir: "tasks",
      storeDir: "store",
      fixtureKey: "human-guided-execution",
    },
  ]);
  assert.deepEqual(calls.lifecycle, [null]);
  assert.deepEqual(calls.events, [
    {
      eventType: "seed-test-state-fixtures",
      fileName: "stub-state-fixtures",
      timestamp: "2026-05-21T00:00:00.000Z",
    },
  ]);
});

test("workflow test fixture service cleans fixtures and emits a task change", async () => {
  const { calls, service } = createFixtureService({
    cleanupResult: {
      removedTaskFiles: 2,
      removedPackages: 2,
    },
  });

  const result = await service.cleanupTestStateFixtures();

  assert.deepEqual(result, {
    removedTaskFiles: 2,
    removedPackages: 2,
  });
  assert.deepEqual(calls.cleanup, [
    {
      repositoryDir: "repo",
      tasksDir: "tasks",
      storeDir: "store",
    },
  ]);
  assert.deepEqual(calls.lifecycle, [null]);
  assert.deepEqual(calls.events, [
    {
      eventType: "cleanup-test-state-fixtures",
      fileName: "stub-state-fixtures",
      timestamp: "2026-05-21T00:00:00.000Z",
    },
  ]);
});
