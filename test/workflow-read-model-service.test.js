import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowReadModelService } from "../src/workflow/workflow-read-model-service.js";

function createReadModelService({
  tasks = [],
  taskPool = { taskContextPackages: [] },
  activeWork = null,
  latestRecommendationRun = null,
  repositoryStatus = { clean: true, entries: [] },
} = {}) {
  const calls = {
    buildCurrentTaskPool: [],
    listTasks: [],
  };
  const service = createWorkflowReadModelService({
    tasksDir: "tasks-dir",
    getRepositoryStatus: async () => repositoryStatus,
    getLatestRecommendationRun: () => latestRecommendationRun,
    listTasks(tasksDir) {
      calls.listTasks.push(tasksDir);
      return tasks;
    },
    taskContextWorkspace: {
      async buildCurrentTaskPool(request) {
        calls.buildCurrentTaskPool.push(request);
        return taskPool;
      },
      findActiveWork(taskContextPackages) {
        assert.equal(taskContextPackages, taskPool.taskContextPackages);
        return activeWork;
      },
    },
  });
  return {
    calls,
    service,
  };
}

test("workflow read model lists raw task sources through the configured task directory", () => {
  const { calls, service } = createReadModelService({
    tasks: [
      {
        fileName: "task.yaml",
      },
    ],
  });

  assert.deepEqual(service.listTasks(), [
    {
      fileName: "task.yaml",
    },
  ]);
  assert.deepEqual(calls.listTasks, ["tasks-dir"]);
});

test("workflow read model builds the task pool with the latest recommendation run", async () => {
  const latestRecommendationRun = {
    id: "recommendation-run-1",
  };
  const { calls, service } = createReadModelService({
    latestRecommendationRun,
    taskPool: {
      entries: [],
      taskContextPackages: [],
    },
  });

  const taskPool = await service.listTaskPool();

  assert.deepEqual(taskPool, {
    entries: [],
    taskContextPackages: [],
  });
  assert.deepEqual(calls.buildCurrentTaskPool, [
    {
      latestRecommendationRun,
    },
  ]);
});

test("workflow read model startup check includes active work from the task pool", async () => {
  const activeWork = {
    packageId: "pkg-active",
    currentWorkStage: "execution-agent",
  };
  const { service } = createReadModelService({
    activeWork,
    repositoryStatus: {
      clean: true,
      entries: [],
    },
    taskPool: {
      taskContextPackages: [
        {
          packageId: "pkg-active",
        },
      ],
    },
  });

  const startupCheck = await service.getStartupCheck();

  assert.equal(startupCheck.canStartWork, false);
  assert.deepEqual(startupCheck.runtimeSnapshot.activeWork, activeWork);
  assert.deepEqual(startupCheck.findings.map((finding) => finding.code), [
    "ACTIVE_WORK_EXISTS",
  ]);
});
