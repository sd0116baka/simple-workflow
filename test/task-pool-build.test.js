import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaskPool } from "../src/workflow/task-pool.js";
import { createInitialTaskModuleStates } from "../src/workflow/module-status.js";
import {
  createExistingTaskContextPackage,
  createTaskSource,
} from "./support/task-pool-fixtures.js";

test("task pool contains parsed tasks with minimal pool metadata", () => {
  const pool = buildTaskPool([
    createTaskSource({
      id: "task-001",
      fileName: "task-001.yaml",
      title: "展示任务真源",
      priority: "normal",
      description: undefined,
      acceptance: undefined,
    }),
    createTaskSource({
      id: "task-002",
      fileName: "task-002.yaml",
      title: "缺少验收标准",
      priority: undefined,
      description: undefined,
      acceptance: undefined,
      validation: {
        status: "invalid",
        errors: ["acceptance must contain at least one item"],
      },
    }),
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
          description: undefined,
          acceptance: undefined,
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
          priority: undefined,
          description: undefined,
          acceptance: undefined,
        },
        validation: {
          status: "invalid",
          errors: ["acceptance must contain at least one item"],
        },
      },
    ],
    taskContextPackages: [
      {
        packageId: "task-context-package:tasks/task-001.yaml",
        currentWorkStage: "task-pool",
        source: {
          path: "tasks/task-001.yaml",
          format: "yaml",
          contentHash: "unavailable",
        },
        recognition: {
          outcome: "recognized",
          findings: [],
        },
        taskDraft: {
          id: "task-001",
          name: "展示任务真源",
          kind: "feature",
          priority: "normal",
          goal: "default",
          acceptanceCriteria: "default",
          maxIterations: "default",
        },
        qualityGate: {
          outcome: "pass",
        },
        artifacts: {},
        agentRuns: [],
        timeline: [],
        modules: createInitialTaskModuleStates(),
      },
      {
        packageId: "task-context-package:tasks/task-002.yaml",
        currentWorkStage: "task-pool",
        source: {
          path: "tasks/task-002.yaml",
          format: "yaml",
          contentHash: "unavailable",
        },
        recognition: {
          outcome: "incomplete",
          findings: [
            {
              field: "taskDraft",
              severity: "blocking",
              message: "acceptance must contain at least one item",
            },
          ],
        },
        taskDraft: {
          id: "task-002",
          name: "缺少验收标准",
          kind: "feature",
          priority: "default",
          goal: "default",
          acceptanceCriteria: "default",
          maxIterations: "default",
        },
        qualityGate: {
          outcome: "fail",
        },
        artifacts: {},
        agentRuns: [],
        timeline: [],
        modules: createInitialTaskModuleStates(),
      },
    ],
    views: {
      candidateTasks: [
        {
          packageId: "task-context-package:tasks/task-001.yaml",
          taskDraft: {
            id: "task-001",
            name: "展示任务真源",
            kind: "feature",
            priority: "normal",
            goal: "default",
            acceptanceCriteria: "default",
            maxIterations: "default",
          },
        },
      ],
      needsAttention: ["task-context-package:tasks/task-002.yaml"],
      brokenContent: [],
    },
  });
});

test("task pool skips files that failed parsing", () => {
  const pool = buildTaskPool([
    createTaskSource({
      id: "broken",
      fileName: "broken.yaml",
      parseError: "YAML parse error",
      validation: {
        status: "invalid",
        errors: ["Cannot validate until YAML parses successfully"],
      },
    }),
  ]);

  assert.deepEqual(pool, {
    entries: [],
    taskContextPackages: [],
    views: {
      candidateTasks: [],
      needsAttention: [],
      brokenContent: [],
    },
  });
});

test("task pool overlays existing workflow package status onto entries and candidates", () => {
  const pool = buildTaskPool(
    [createTaskSource()],
    {
      taskContextPackages: [
        createExistingTaskContextPackage({
          artifacts: {
            taskCloseout: {
              artifactId: "taskCloseout",
              body: {},
              appendedAt: "2026-05-19T00:00:00.000Z",
            },
          },
        }),
      ],
    },
  );

  assert.equal(pool.entries[0].status, "closed");
  assert.equal(pool.taskContextPackages[0].currentWorkStage, "closed");
  assert.equal(pool.taskContextPackages[0].artifacts.taskCloseout.artifactId, "taskCloseout");
  assert.deepEqual(pool.views.candidateTasks, []);
});

test("task pool candidates include only valid tasks that have not started workflow", () => {
  const pool = buildTaskPool(
    [
      createTaskSource({
        id: "task-ready",
        fileName: "task-ready.yaml",
        title: "可启动任务",
        priority: "normal",
        description: undefined,
        acceptance: undefined,
      }),
      createTaskSource({
        id: "task-active",
        fileName: "task-active.yaml",
        title: "人工决策中任务",
        priority: "normal",
        description: undefined,
        acceptance: undefined,
      }),
      createTaskSource({
        id: "task-invalid",
        fileName: "task-invalid.yaml",
        title: undefined,
        priority: undefined,
        description: undefined,
        acceptance: undefined,
        validation: { status: "invalid", errors: ["title must be a non-empty string"] },
      }),
    ],
    {
      taskContextPackages: [
        createExistingTaskContextPackage({
          packageId: "task-context-package:tasks/task-active.yaml",
          currentWorkStage: "human-decision",
          artifacts: {
            humanDecisionRequest: {
              artifactId: "humanDecisionRequest",
              body: {},
              appendedAt: "2026-05-19T00:00:00.000Z",
            },
          },
        }),
      ],
    },
  );

  assert.deepEqual(
    pool.views.candidateTasks.map((task) => task.packageId),
    ["task-context-package:tasks/task-ready.yaml"],
  );
  assert.equal(pool.entries.find((entry) => entry.id === "task-active").status, "human-decision");
  assert.equal(pool.entries.find((entry) => entry.id === "task-invalid").status, "blocked");
  assert.deepEqual(pool.views.needsAttention, ["task-context-package:tasks/task-invalid.yaml"]);
});
