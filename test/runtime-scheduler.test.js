import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRuntime } from "../src/workflow/runtime-scheduler.js";

test("runtime scheduler allows starting when task pool has ready tasks", () => {
  const runtime = evaluateRuntime({
    entries: [
      {
        id: "task-001",
        title: "展示任务真源",
        type: "feature",
        priority: "normal",
        status: "ready",
        sourceFile: "task-001.yaml",
      },
      {
        id: "task-002",
        title: "不完整任务",
        type: "feature",
        priority: "low",
        status: "blocked",
        sourceFile: "task-002.yaml",
      },
    ],
  }, {
    clean: true,
    entries: [],
  });

  assert.deepEqual(runtime, {
    status: "idle",
    canStartNewTask: true,
    runnableTasks: [
      {
        id: "task-001",
        title: "展示任务真源",
        type: "feature",
        priority: "normal",
        sourceFile: "task-001.yaml",
      },
    ],
    blockingReasons: [],
    repositoryStatus: {
      clean: true,
      entries: [],
    },
  });
});

test("runtime scheduler blocks when task pool has no ready tasks", () => {
  const runtime = evaluateRuntime({
    entries: [
      {
        id: "task-002",
        title: "不完整任务",
        type: "feature",
        priority: "low",
        status: "blocked",
        sourceFile: "task-002.yaml",
      },
    ],
  }, {
    clean: true,
    entries: [],
  });

  assert.deepEqual(runtime, {
    status: "blocked",
    canStartNewTask: false,
    runnableTasks: [],
    blockingReasons: ["No ready tasks in task pool"],
    repositoryStatus: {
      clean: true,
      entries: [],
    },
  });
});

test("runtime scheduler blocks when task pool is empty", () => {
  const runtime = evaluateRuntime({ entries: [] }, { clean: true, entries: [] });

  assert.deepEqual(runtime, {
    status: "blocked",
    canStartNewTask: false,
    runnableTasks: [],
    blockingReasons: ["No ready tasks in task pool"],
    repositoryStatus: {
      clean: true,
      entries: [],
    },
  });
});

test("runtime scheduler blocks when repository has uncommitted changes", () => {
  const runtime = evaluateRuntime({
    entries: [
      {
        id: "task-001",
        title: "展示任务真源",
        type: "feature",
        priority: "normal",
        status: "ready",
        sourceFile: "task-001.yaml",
      },
    ],
  }, {
    clean: false,
    entries: [{ code: "M", path: "public/app.js" }],
  });

  assert.deepEqual(runtime, {
    status: "blocked",
    canStartNewTask: false,
    runnableTasks: [
      {
        id: "task-001",
        title: "展示任务真源",
        type: "feature",
        priority: "normal",
        sourceFile: "task-001.yaml",
      },
    ],
    blockingReasons: ["Working tree has uncommitted changes"],
    repositoryStatus: {
      clean: false,
      entries: [{ code: "M", path: "public/app.js" }],
    },
  });
});
