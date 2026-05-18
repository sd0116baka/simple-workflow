import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaskPool } from "../src/workflow/task-pool.js";

test("task pool contains parsed tasks with minimal pool metadata", () => {
  const pool = buildTaskPool([
    {
      id: "task-001",
      fileName: "task-001.yaml",
      parsed: {
        id: "task-001",
        title: "展示任务真源",
        type: "feature",
        priority: "normal",
      },
      parseError: null,
      validation: { status: "valid", errors: [] },
    },
    {
      id: "task-002",
      fileName: "task-002.yaml",
      parsed: {
        id: "task-002",
        title: "缺少验收标准",
        type: "feature",
      },
      parseError: null,
      validation: {
        status: "invalid",
        errors: ["acceptance must contain at least one item"],
      },
    },
  ]);

  assert.deepEqual(pool, {
    entries: [
      {
        id: "task-001",
        packageId: "task-context-package:tasks/task-001.yaml",
        sourceFile: "task-001.yaml",
        title: "展示任务真源",
        type: "feature",
        priority: "normal",
        status: "ready",
        parsed: {
          id: "task-001",
          title: "展示任务真源",
          type: "feature",
          priority: "normal",
        },
        validation: { status: "valid", errors: [] },
      },
      {
        id: "task-002",
        packageId: "task-context-package:tasks/task-002.yaml",
        sourceFile: "task-002.yaml",
        title: "缺少验收标准",
        type: "feature",
        priority: null,
        status: "blocked",
        parsed: {
          id: "task-002",
          title: "缺少验收标准",
          type: "feature",
        },
        validation: {
          status: "invalid",
          errors: ["acceptance must contain at least one item"],
        },
      },
    ],
    views: {
      candidateTasks: [
        {
          packageId: "task-context-package:tasks/task-001.yaml",
          id: "task-001",
          title: "展示任务真源",
          type: "feature",
          priority: "normal",
          sourceFile: "task-001.yaml",
        },
      ],
      needsAttention: ["task-context-package:tasks/task-002.yaml"],
      brokenContent: [],
    },
  });
});

test("task pool skips files that failed parsing", () => {
  const pool = buildTaskPool([
    {
      id: "broken",
      fileName: "broken.yaml",
      parsed: null,
      parseError: "YAML parse error",
      validation: {
        status: "invalid",
        errors: ["Cannot validate until YAML parses successfully"],
      },
    },
  ]);

  assert.deepEqual(pool, {
    entries: [],
    views: {
      candidateTasks: [],
      needsAttention: [],
      brokenContent: [],
    },
  });
});
