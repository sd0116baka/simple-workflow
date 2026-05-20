import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTaskContextPackages } from "../src/workflow/task-context-package-store.js";
import { listRawTasks } from "../src/workflow/task-source.js";
import { seedTestStateFixtures } from "../src/workflow/state-fixtures.js";

test("seeds stub tasks across workflow stages in the test environment", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "simple-workflow-fixtures-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const repositoryDir = join(rootDir, ".workflow", "test-environment", "repository");
  const tasksDir = join(repositoryDir, "tasks");
  const storeDir = join(repositoryDir, ".workflow", "task-context-packages");

  const result = await seedTestStateFixtures({
    repositoryDir,
    tasksDir,
    storeDir,
    now: () => "2026-05-20T10:00:00.000Z",
  });
  const tasks = await listRawTasks(tasksDir);
  const packages = await loadTaskContextPackages({ storeDir });
  const stages = new Set(packages.map((taskPackage) => taskPackage.currentWorkStage));

  assert.equal(result.count, 15);
  assert.equal(tasks.length, 15);
  assert.equal(packages.length, 15);
  assert.equal(stages.has("task-pool"), true);
  assert.equal(stages.has("human-decision"), true);
  assert.equal(stages.has("closed"), true);
  assert.equal(stages.has("cancelled"), true);

  const humanDecisionPackage = packages.find((taskPackage) =>
    taskPackage.currentWorkStage === "human-decision"
      && taskPackage.artifacts.convergenceFailure);
  assert.equal(
    humanDecisionPackage.artifacts.humanDecisionRequest.body.targetRef,
    "convergenceFailure:001",
  );
  assert.deepEqual(humanDecisionPackage.artifacts.humanDecisionRequest.body.decisionOptions, [
    "retry-with-guidance",
    "cancel-task",
  ]);
});

test("refuses to seed state fixtures outside the managed test environment", async (t) => {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-real-repo-"));
  t.after(() => rm(repositoryDir, { recursive: true, force: true }));

  await assert.rejects(
    () => seedTestStateFixtures({
      repositoryDir,
      tasksDir: join(repositoryDir, "tasks"),
      storeDir: join(repositoryDir, ".workflow", "task-context-packages"),
    }),
    /测试状态种子只能写入/,
  );
});
