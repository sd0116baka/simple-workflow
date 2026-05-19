import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAppendRequest,
  buildTaskPool,
  findTaskContextPackage,
} from "../src/workflow/task-pool.js";

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
    taskContextPackages: [],
    views: {
      candidateTasks: [],
      needsAttention: [],
      brokenContent: [],
    },
  });
});

test("task pool applies append requests to the target task context package", () => {
  const pool = buildTaskPool([
    {
      id: "task-003",
      fileName: "task-003.yaml",
      parsed: {
        id: "task-003",
        title: "监听任务文件变化",
        type: "feature",
        priority: "high",
        description: "监听 tasks 目录变化",
        acceptance: ["修改任务源文件后界面自动刷新"],
      },
      parseError: null,
      validation: { status: "valid", errors: [] },
    },
  ]);

  const withIntent = applyAppendRequest(
    pool,
    {
      packageId: "task-context-package:tasks/task-003.yaml",
      artifactType: "executionIntent",
      artifact: {
        recommendedPackageId: "task-context-package:tasks/task-003.yaml",
        confidence: "high",
      },
    },
    { currentWorkStage: "task-recommender" },
  );

  const taskPackage = findTaskContextPackage(
    withIntent,
    "task-context-package:tasks/task-003.yaml",
  );

  assert.equal(taskPackage.currentWorkStage, "task-recommender");
  assert.equal(taskPackage.artifacts.executionIntent.artifactId, "executionIntent");
  assert.equal(taskPackage.artifacts.executionIntent.body.confidence, "high");
  assert.equal(taskPackage.timeline[0].artifactType, "executionIntent");
  assert.equal(taskPackage.timeline[0].artifactId, "executionIntent");
});

test("task pool records agent runs and generated multi artifact refs", () => {
  const pool = buildTaskPool([
    {
      id: "task-003",
      fileName: "task-003.yaml",
      parsed: {
        id: "task-003",
        title: "监听任务文件变化",
        type: "feature",
        priority: "high",
        description: "监听 tasks 目录变化",
        acceptance: ["修改任务源文件后界面自动刷新"],
      },
      parseError: null,
      validation: { status: "valid", errors: [] },
    },
  ]);

  const withReport = applyAppendRequest(
    pool,
    {
      packageId: "task-context-package:tasks/task-003.yaml",
      artifactType: "executionReport",
      artifact: {
        summary: "完成监听实现",
      },
      agentRun: {
        runId: "execution-agent:001",
        role: "execution",
        sessionId: "opencode-session-execution-002",
        inputArtifactRefs: ["taskDraft", "executionAuthorization"],
        outputArtifactRefs: [],
        status: "succeeded",
        startedAt: "2026-05-18T10:00:00.000Z",
        finishedAt: "2026-05-18T10:10:00.000Z",
      },
    },
    { currentWorkStage: "execution-agent" },
  );

  const taskPackage = findTaskContextPackage(
    withReport,
    "task-context-package:tasks/task-003.yaml",
  );

  assert.equal(taskPackage.currentWorkStage, "execution-agent");
  assert.equal(taskPackage.artifacts.executionReport[0].artifactId, "executionReport:001");
  assert.equal(taskPackage.artifacts.executionReport[0].body.summary, "完成监听实现");
  assert.equal(taskPackage.agentRuns[0].sessionId, "opencode-session-execution-002");
  assert.deepEqual(taskPackage.agentRuns[0].outputArtifactRefs, ["executionReport:001"]);
  assert.equal(taskPackage.timeline[0].agentRunId, "execution-agent:001");
});

test("task pool records a main agent run without requiring an artifact", () => {
  const pool = buildTaskPool([
    {
      id: "task-003",
      fileName: "task-003.yaml",
      parsed: {
        id: "task-003",
        title: "监听任务文件变化",
        type: "feature",
        priority: "high",
        description: "监听 tasks 目录变化",
        acceptance: ["修改任务源文件后界面自动刷新"],
      },
      parseError: null,
      validation: { status: "valid", errors: [] },
    },
  ]);

  const withMainRun = applyAppendRequest(
    pool,
    {
      packageId: "task-context-package:tasks/task-003.yaml",
      agentRun: {
        runId: "main-agent:initialization",
        role: "main",
        sessionId: "opencode-session-main-task-003",
        inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization"],
        outputArtifactRefs: [],
        status: "succeeded",
        startedAt: "2026-05-18T10:00:00.000Z",
        finishedAt: "2026-05-18T10:00:10.000Z",
      },
    },
    { currentWorkStage: "main-agent" },
  );

  const taskPackage = findTaskContextPackage(
    withMainRun,
    "task-context-package:tasks/task-003.yaml",
  );

  assert.equal(taskPackage.currentWorkStage, "main-agent");
  assert.deepEqual(taskPackage.artifacts, {});
  assert.equal(taskPackage.agentRuns[0].role, "main");
  assert.deepEqual(taskPackage.agentRuns[0].outputArtifactRefs, []);
  assert.equal(taskPackage.timeline[0].artifactId, null);
  assert.equal(taskPackage.timeline[0].agentRunId, "main-agent:initialization");
});
