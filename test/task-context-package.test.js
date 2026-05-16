import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaskContextPackage } from "../src/workflow/task-context-package.js";

const taskPool = {
  entries: [
    {
      id: "task-003",
      sourceFile: "task-003.yaml",
      title: "监听任务文件变化",
      type: "feature",
      priority: "high",
      status: "ready",
      validation: { status: "valid", errors: [] },
    },
  ],
};

const executionIntent = {
  recommendedTask: {
    id: "task-003",
    sourceFile: "tasks/task-003.yaml",
    title: "监听任务文件变化",
    priority: "high",
  },
  confidence: "high",
  rationale: ["唯一 high 优先级任务"],
  nextAction: "优先实现 task-003。",
};

test("builds a task context package with appended execution authorization", () => {
  const taskContextPackage = buildTaskContextPackage({
    taskPool,
    executionIntent,
    executionAdmission: {
      status: "authorized",
      authorized: true,
      taskId: "task-003",
      requiresConfirmation: true,
      reasons: [],
      runtimeStatus: "idle",
    },
  });

  assert.equal(taskContextPackage.id, "task-context-package:task-003");
  assert.equal(taskContextPackage.status, "authorization-appended");
  assert.equal(taskContextPackage.currentStage, "执行准入器");
  assert.equal(taskContextPackage.task.validationStatus, "valid");
  assert.equal(taskContextPackage.appended.executionIntent.confidence, "high");
  assert.equal(taskContextPackage.appended.executionAuthorization.requiresConfirmation, true);
  assert.equal(taskContextPackage.appended.admissionBlock, null);
  assert.deepEqual(
    taskContextPackage.records.map((record) => record.artifact),
    ["任务上下文包", "执行意图", "执行授权"],
  );
});

test("keeps an authorization block in the task context package without adding authorization", () => {
  const taskContextPackage = buildTaskContextPackage({
    taskPool,
    executionIntent,
    executionAdmission: {
      status: "blocked",
      authorized: false,
      taskId: "task-003",
      requiresConfirmation: false,
      reasons: ["Working tree has uncommitted changes"],
    },
  });

  assert.equal(taskContextPackage.status, "authorization-blocked");
  assert.equal(taskContextPackage.appended.executionAuthorization, null);
  assert.deepEqual(taskContextPackage.appended.admissionBlock.reasons, [
    "Working tree has uncommitted changes",
  ]);
  assert.equal(taskContextPackage.records.at(-1).artifact, "授权拒绝");
});

test("returns null before an execution intent selects a task", () => {
  assert.equal(buildTaskContextPackage({ taskPool }), null);
});
