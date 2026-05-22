import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowTaskContextMutationService } from "../src/workflow/workflow-task-context-mutation-service.js";

function createMutationService({
  latestRecommendationRun = null,
  appliedTaskContextPackage = null,
  taskPool = { entries: [] },
} = {}) {
  const calls = {
    persist: [],
    apply: [],
  };
  const service = createWorkflowTaskContextMutationService({
    getLatestRecommendationRun: () => latestRecommendationRun,
    taskContextWorkspace: {
      async persistTaskContextPackage(taskContextPackage) {
        calls.persist.push(taskContextPackage);
      },
      async applyAppendRequestToCurrentPool(appendRequest, options) {
        calls.apply.push({
          appendRequest,
          options,
        });
        return {
          taskPool,
          taskContextPackage: appliedTaskContextPackage,
        };
      },
    },
  });
  return {
    calls,
    service,
  };
}

test("workflow task context mutation service delegates package persistence", async () => {
  const taskContextPackage = {
    packageId: "pkg-1",
  };
  const { calls, service } = createMutationService();

  await service.persistTaskContextPackage(taskContextPackage);

  assert.deepEqual(calls.persist, [taskContextPackage]);
});

test("workflow task context mutation service applies append requests with the latest run", async () => {
  const latestRecommendationRun = {
    id: "recommendation-run-1",
    taskContextPackage: {
      packageId: "pkg-old",
    },
  };
  const updatedTaskContextPackage = {
    packageId: "pkg-updated",
    currentWorkStage: "review-agent",
  };
  const taskPool = {
    entries: [
      {
        id: "task-1",
      },
    ],
  };
  const appendRequest = {
    packageId: "pkg-updated",
    artifacts: [],
  };
  const { calls, service } = createMutationService({
    latestRecommendationRun,
    appliedTaskContextPackage: updatedTaskContextPackage,
    taskPool,
  });

  const result = await service.applyAppendRequest(appendRequest, {
    currentWorkStage: "review-agent",
  });

  assert.equal(result, taskPool);
  assert.deepEqual(calls.apply, [
    {
      appendRequest,
      options: {
        currentWorkStage: "review-agent",
        latestRecommendationRun,
      },
    },
  ]);
  assert.equal(latestRecommendationRun.taskContextPackage, updatedTaskContextPackage);
});

test("workflow task context mutation service leaves latest run unchanged when no package is returned", async () => {
  const latestRecommendationRun = {
    id: "recommendation-run-1",
    taskContextPackage: {
      packageId: "pkg-old",
    },
  };
  const originalPackage = latestRecommendationRun.taskContextPackage;
  const { service } = createMutationService({
    latestRecommendationRun,
    appliedTaskContextPackage: null,
  });

  await service.applyAppendRequest({
    packageId: "pkg-missing",
  });

  assert.equal(latestRecommendationRun.taskContextPackage, originalPackage);
});
