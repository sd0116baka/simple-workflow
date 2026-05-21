import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSupportedTaskFile, listRawTasks } from "../src/workflow/task-source.js";

test("detects supported task source files", () => {
  assert.equal(isSupportedTaskFile("task.yaml"), true);
  assert.equal(isSupportedTaskFile("task.YML"), true);
  assert.equal(isSupportedTaskFile("notes.txt"), false);
  assert.equal(isSupportedTaskFile(null), false);
});

test("lists YAML task files as raw text without parsing them", async (t) => {
  const dir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "raw-list");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "first.yaml"), "id: first\ntitle: 第一项任务\n");
  await writeFile(join(dir, "second.yml"), "id: second\n");
  await writeFile(join(dir, "ignored.json"), "{\n  \"id\": \"ignored\"\n}\n");
  await writeFile(join(dir, "notes.txt"), "not a task");

  const tasks = await listRawTasks(dir);

  assert.deepEqual(
    tasks.map((task) => task.fileName),
    ["first.yaml", "second.yml"],
  );
  assert.equal(tasks[0].format, "yaml");
  assert.equal(tasks[0].rawText, "id: first\ntitle: 第一项任务\n");
  assert.equal(tasks[0].validation.status, "invalid");
  assert.equal(tasks[1].format, "yaml");
  assert.equal(tasks[1].rawText, "id: second\n");
  assert.equal(tasks[1].validation.status, "invalid");
});

test("returns an empty list when the tasks directory does not exist", async () => {
  const tasks = await listRawTasks(join(process.cwd(), ".tmp-test-tasks", "missing"));

  assert.deepEqual(tasks, []);
});
