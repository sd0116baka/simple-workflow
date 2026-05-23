import { test } from "node:test";
import assert from "node:assert/strict";
import { createTaskSourceMutationService } from "../src/workflow/task-source-mutation-service.js";

test("task source mutation service writes text and emits a task change", async () => {
  const calls = [];
  const service = createTaskSourceMutationService({
    tasksDir: "tasks",
    now: () => "2026-05-22T10:00:00.000Z",
    emitTaskChange: (event) => calls.push(["emitTaskChange", event]),
    createTaskSource: async (input) => {
      calls.push(["createTaskSource", input]);
      return { fileName: "drafted-task.yaml" };
    },
  });

  assert.deepEqual(
    await service.createTaskSourceFromText({ taskSourceText: "id: drafted-task\n" }),
    { fileName: "drafted-task.yaml" },
  );
  assert.deepEqual(calls, [
    ["createTaskSource", {
      tasksDir: "tasks",
      taskSourceText: "id: drafted-task\n",
    }],
    ["emitTaskChange", {
      eventType: "create-task-source",
      fileName: "drafted-task.yaml",
      timestamp: "2026-05-22T10:00:00.000Z",
    }],
  ]);
});
