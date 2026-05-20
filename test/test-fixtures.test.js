import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTaskContextPackages } from "../src/workflow/task-context-package-store.js";
import { listRawTasks } from "../src/workflow/task-source.js";
import {
  cleanupTestStateFixtures,
  seedTestStateFixtures,
} from "../src/workflow/state-fixtures.js";

test("seeds one selected stub task and replaces previous fixtures", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "simple-workflow-fixtures-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const repositoryDir = join(rootDir, ".workflow", "test-environment", "repository");
  const tasksDir = join(repositoryDir, "tasks");
  const storeDir = join(repositoryDir, ".workflow", "task-context-packages");

  const result = await seedTestStateFixtures({
    repositoryDir,
    tasksDir,
    storeDir,
    fixtureKey: "convergence-failure",
    now: () => "2026-05-20T10:00:00.000Z",
  });
  const tasks = await listRawTasks(tasksDir);
  const packages = await loadTaskContextPackages({ storeDir });

  assert.equal(result.count, 1);
  assert.equal(tasks.length, 1);
  assert.equal(packages.length, 1);
  assert.equal(result.tasks[0].currentWorkStage, "human-decision");
  assert.equal(packages[0].currentWorkStage, "human-decision");

  assert.equal(
    packages[0].artifacts.humanDecisionRequest.body.targetRef,
    "convergenceFailure:001",
  );
  assert.deepEqual(packages[0].artifacts.humanDecisionRequest.body.decisionOptions, [
    "retry-with-guidance",
    "cancel-task",
  ]);

  await seedTestStateFixtures({
    repositoryDir,
    tasksDir,
    storeDir,
    fixtureKey: "closed",
    now: () => "2026-05-20T10:01:00.000Z",
  });
  const replacedTasks = await listRawTasks(tasksDir);
  const replacedPackages = await loadTaskContextPackages({ storeDir });

  assert.equal(replacedTasks.length, 1);
  assert.equal(replacedTasks[0].fileName, "stub-closed.yaml");
  assert.equal(replacedPackages.length, 1);
  assert.equal(replacedPackages[0].currentWorkStage, "closed");
});

test("cleans generated stub tasks and packages", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "simple-workflow-fixtures-cleanup-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const repositoryDir = join(rootDir, ".workflow", "test-environment", "repository");
  const tasksDir = join(repositoryDir, "tasks");
  const storeDir = join(repositoryDir, ".workflow", "task-context-packages");

  await seedTestStateFixtures({
    repositoryDir,
    tasksDir,
    storeDir,
    fixtureKey: "cancelled",
  });
  const result = await cleanupTestStateFixtures({ repositoryDir, tasksDir, storeDir });
  const tasks = await listRawTasks(tasksDir);
  const packages = await loadTaskContextPackages({ storeDir });

  assert.equal(result.removedTaskFiles, 1);
  assert.equal(result.removedPackages, 1);
  assert.equal(tasks.length, 0);
  assert.equal(packages.length, 0);
});

test("convergence success fixture requests human decision and settles there", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "simple-workflow-fixtures-completion-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const repositoryDir = join(rootDir, ".workflow", "test-environment", "repository");
  const tasksDir = join(repositoryDir, "tasks");
  const storeDir = join(repositoryDir, ".workflow", "task-context-packages");

  const result = await seedTestStateFixtures({
    repositoryDir,
    tasksDir,
    storeDir,
    fixtureKey: "convergence-success",
  });
  const packages = await loadTaskContextPackages({ storeDir });

  assert.equal(result.tasks[0].sourcePath, "tasks/stub-convergence-success.yaml");
  assert.equal(result.tasks[0].currentWorkStage, "human-decision");
  assert.equal(packages[0].currentWorkStage, "human-decision");
  assert.equal(packages[0].artifacts.convergenceSuccess.artifactId, "convergenceSuccess");
  assert.equal(
    packages[0].artifacts.humanDecisionRequest.body.convergenceSuccessRef,
    "convergenceSuccess",
  );
  assert.deepEqual(packages[0].artifacts.humanDecisionRequest.body.decisionOptions, [
    "accept-completion",
    "request-changes",
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
      fixtureKey: "task-pool",
    }),
    /测试状态种子只能写入/,
  );
});
