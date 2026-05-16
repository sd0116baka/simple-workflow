import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowService } from "../src/workflow/workflow-service.js";

test("workflow service lists task source files with raw text and parsed data", async () => {
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "service");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(join(tasksDir, "task.yaml"), "id: task-service\ntitle: 服务边界\n");

  const service = createWorkflowService({ tasksDir });
  const tasks = await service.listTasks();

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].fileName, "task.yaml");
  assert.equal(tasks[0].rawText, "id: task-service\ntitle: 服务边界\n");
  assert.deepEqual(tasks[0].parsed, {
    id: "task-service",
    title: "服务边界",
  });
  assert.equal(tasks[0].parseError, null);
  assert.equal(tasks[0].validation.status, "invalid");
});

test("workflow service emits tasks-changed when a YAML task file changes", async (t) => {
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "events");
  await mkdir(tasksDir, { recursive: true });

  const service = createWorkflowService({ tasksDir, watchDebounceMs: 5 });
  await service.startWatching();
  t.after(() => service.stopWatching());

  const eventPromise = new Promise((resolve) => {
    service.onEvent(resolve);
  });

  await writeFile(join(tasksDir, "task-event.yaml"), "id: task-event\n");

  const event = await Promise.race([
    eventPromise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timed out waiting for tasks-changed")), 1000);
    }),
  ]);

  assert.equal(event.type, "tasks-changed");
  assert.equal(event.fileName, "task-event.yaml");
});
