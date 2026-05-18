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

test("workflow service exposes a task pool built from parsed tasks", async () => {
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "pool");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, "task.yaml"),
    [
      "id: task-pool",
      "title: 任务池",
      "type: feature",
      "description: 容纳解析后的任务",
      "acceptance:",
      "  - 池内能看到该任务",
      "",
    ].join("\n"),
  );

  const service = createWorkflowService({ tasksDir });
  const pool = await service.listTaskPool();

  assert.equal(pool.entries.length, 1);
  assert.equal(pool.entries[0].id, "task-pool");
  assert.equal(pool.entries[0].sourceFile, "task.yaml");
  assert.equal(pool.entries[0].status, "ready");
});

test("workflow service exposes startup check from repository status", async () => {
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "startup-check");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, "task.yaml"),
    [
      "id: task-startup-check",
      "title: 启动检查",
      "type: feature",
      "description: 检查运行环境",
      "acceptance:",
      "  - 可以看到 canStartWork",
      "",
    ].join("\n"),
  );

  const service = createWorkflowService({
      tasksDir,
      getRepositoryStatus: async () => ({ clean: true, entries: [] }),
  });
  const startupCheck = await service.getStartupCheck();

  assert.equal(startupCheck.canStartWork, true);
  assert.deepEqual(startupCheck.findings, []);
  assert.equal(startupCheck.runtimeSnapshot.worktree.clean, true);
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
