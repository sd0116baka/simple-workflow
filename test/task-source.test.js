import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRawTaskSource, isSupportedTaskFile, listRawTasks } from "../src/workflow/task-source.js";

test("detects supported task source files", () => {
  assert.equal(isSupportedTaskFile("task.yaml"), true);
  assert.equal(isSupportedTaskFile("task.YML"), true);
  assert.equal(isSupportedTaskFile("notes.txt"), false);
  assert.equal(isSupportedTaskFile(null), false);
});

test("lists YAML task files with parsed and validated task data", async (t) => {
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
  assert.deepEqual(tasks[0].parsed, { id: "first", title: "第一项任务" });
  assert.equal(tasks[0].validation.status, "invalid");
  assert.equal(tasks[1].format, "yaml");
  assert.equal(tasks[1].rawText, "id: second\n");
  assert.deepEqual(tasks[1].parsed, { id: "second" });
  assert.equal(tasks[1].validation.status, "invalid");
});

test("lists YAML parse errors without throwing", async () => {
  const dir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "parse-error");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "broken.yaml"), "id: task-001\nacceptance:\n  - ok\n - broken");

  const [task] = await listRawTasks(dir);

  assert.equal(task.parsed, null);
  assert.match(task.parseError, /yaml/i);
  assert.equal(task.validation.status, "invalid");
});

test("returns an empty list when the tasks directory does not exist", async () => {
  const tasks = await listRawTasks(join(process.cwd(), ".tmp-test-tasks", "missing"));

  assert.deepEqual(tasks, []);
});

test("creates a validated YAML task source file", async () => {
  const dir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "create");
  const task = await createRawTaskSource({
    tasksDir: dir,
    taskSourceText: [
      "id: drafted-task",
      "title: 起草任务",
      "type: feature",
      "description: 测试写入",
      "acceptance:",
      "  - 写入成功",
    ].join("\n"),
  });

  assert.equal(task.fileName, "drafted-task.yaml");
  assert.equal(task.validation.status, "valid");
  assert.equal(
    await readFile(join(dir, "drafted-task.yaml"), "utf8"),
    [
      "id: drafted-task",
      "title: 起草任务",
      "type: feature",
      "description: 测试写入",
      "acceptance:",
      "  - 写入成功",
      "",
    ].join("\n"),
  );
});

test("rejects invalid and unsafe task source writes", async () => {
  await assert.rejects(
    () => createRawTaskSource({
      tasksDir: join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "invalid"),
      taskSourceText: "id: ../bad\ntitle: 坏任务\ntype: feature\ndescription: no\nacceptance:\n  - no\n",
    }),
    /kebab-case/,
  );
  await assert.rejects(
    () => createRawTaskSource({
      tasksDir: join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "missing-fields"),
      taskSourceText: "id: missing-fields\n",
    }),
    /task source is invalid/,
  );
});
