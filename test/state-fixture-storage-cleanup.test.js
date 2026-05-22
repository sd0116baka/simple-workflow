import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupStateFixtureStorage,
} from "../src/workflow/state-fixture-storage-cleanup.js";

test("state fixture storage cleanup removes only generated stub tasks and packages", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "simple-workflow-fixture-storage-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const tasksDir = join(rootDir, "tasks");
  const storeDir = join(rootDir, ".workflow", "task-context-packages");
  await mkdir(tasksDir, { recursive: true });
  await mkdir(storeDir, { recursive: true });
  await writeFile(join(tasksDir, "stub-review-agent.yaml"), "stub task\n", "utf8");
  await writeFile(join(tasksDir, "stub-human-guided-execution.yml"), "stub task\n", "utf8");
  await writeFile(join(tasksDir, "real-task.yaml"), "real task\n", "utf8");
  await writeFile(join(storeDir, "tasks-stub-review-agent.yaml.json"), "{}\n", "utf8");
  await writeFile(join(storeDir, "tasks-stub-human-guided-execution.yml.json"), "{}\n", "utf8");
  await writeFile(join(storeDir, "task-context-package-real-task.json"), "{}\n", "utf8");

  const result = await cleanupStateFixtureStorage({ tasksDir, storeDir });

  assert.deepEqual(result, {
    removedTaskFiles: 2,
    removedPackages: 2,
  });
  assert.equal(existsSync(join(tasksDir, "stub-review-agent.yaml")), false);
  assert.equal(existsSync(join(tasksDir, "stub-human-guided-execution.yml")), false);
  assert.equal(existsSync(join(tasksDir, "real-task.yaml")), true);
  assert.equal(existsSync(join(storeDir, "tasks-stub-review-agent.yaml.json")), false);
  assert.equal(existsSync(join(storeDir, "tasks-stub-human-guided-execution.yml.json")), false);
  assert.equal(existsSync(join(storeDir, "task-context-package-real-task.json")), true);
});

test("state fixture storage cleanup treats missing directories as empty", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "simple-workflow-fixture-storage-missing-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));

  assert.deepEqual(await cleanupStateFixtureStorage({
    tasksDir: join(rootDir, "missing-tasks"),
    storeDir: join(rootDir, "missing-store"),
  }), {
    removedTaskFiles: 0,
    removedPackages: 0,
  });
});

test("state fixture storage cleanup requires both storage directories", async () => {
  await assert.rejects(
    () => cleanupStateFixtureStorage({ tasksDir: "tasks" }),
    /tasksDir and storeDir are required/,
  );
});
