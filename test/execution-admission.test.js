import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateExecutionAdmission } from "../src/workflow/execution-admission.js";

function intent(taskId = "task-001") {
  return {
    recommendedTask: {
      id: taskId,
      sourceFile: `tasks/${taskId}.yaml`,
      title: "展示任务真源",
      priority: "normal",
    },
  };
}

function taskPool(status = "ready") {
  return {
    entries: [
      {
        id: "task-001",
        sourceFile: "tasks/task-001.yaml",
        title: "展示任务真源",
        type: "feature",
        priority: "normal",
        status,
      },
    ],
  };
}

function runtime(overrides = {}) {
  return {
    status: "idle",
    canStartNewTask: true,
    runnableTasks: [{ id: "task-001" }],
    blockingReasons: [],
    ...overrides,
  };
}

test("allows a ready recommended task when runtime can start", () => {
  const admission = evaluateExecutionAdmission({
    executionIntent: intent(),
    taskPool: taskPool(),
    runtimeStatus: runtime(),
  });

  assert.equal(admission.status, "authorized");
  assert.equal(admission.authorized, true);
  assert.equal(admission.requiresConfirmation, true);
  assert.equal(admission.taskId, "task-001");
});

test("blocks when there is no execution intent", () => {
  const admission = evaluateExecutionAdmission({
    executionIntent: null,
    taskPool: taskPool(),
    runtimeStatus: runtime(),
  });

  assert.equal(admission.status, "blocked");
  assert.equal(admission.authorized, false);
  assert.deepEqual(admission.reasons, ["No execution intent"]);
});

test("blocks when the recommended task is not in the task pool", () => {
  const admission = evaluateExecutionAdmission({
    executionIntent: intent("task-404"),
    taskPool: taskPool(),
    runtimeStatus: runtime(),
  });

  assert.equal(admission.status, "blocked");
  assert.match(admission.reasons[0], /not in the task pool/);
});

test("blocks when the recommended task is not ready", () => {
  const admission = evaluateExecutionAdmission({
    executionIntent: intent(),
    taskPool: taskPool("blocked"),
    runtimeStatus: runtime(),
  });

  assert.equal(admission.status, "blocked");
  assert.match(admission.reasons[0], /is blocked/);
});

test("blocks when runtime cannot start a task", () => {
  const admission = evaluateExecutionAdmission({
    executionIntent: intent(),
    taskPool: taskPool(),
    runtimeStatus: runtime({
      status: "blocked",
      canStartNewTask: false,
      blockingReasons: ["Working tree has uncommitted changes"],
    }),
  });

  assert.equal(admission.status, "blocked");
  assert.deepEqual(admission.reasons, ["Working tree has uncommitted changes"]);
});
