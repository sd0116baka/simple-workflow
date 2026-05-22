import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTaskContextPackageWorkspace,
} from "../src/workflow/task-context-package-workspace.js";

async function createTasksDir() {
  const root = await mkdtemp(join(tmpdir(), "simple-workflow-package-workspace-"));
  const tasksDir = join(root, "tasks");
  const storeDir = join(root, ".workflow", "task-context-packages");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, "task-001.yaml"),
    [
      "id: task-001",
      "title: 测试任务",
      "type: feature",
      "description: 验证任务上下文包 workspace",
      "acceptance:",
      "  - 可以追加产物",
      "",
    ].join("\n"),
  );
  return { tasksDir, storeDir };
}

test("task context package workspace applies append requests and persists the updated package", async () => {
  const { tasksDir, storeDir } = await createTasksDir();
  const workspace = createTaskContextPackageWorkspace({
    tasksDir,
    taskContextPackageStoreDir: storeDir,
  });

  const appendRequest = {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType: "executionIntent",
    artifact: {
      recommendedPackageId: "task-context-package:tasks/task-001.yaml",
      appendedAt: "2026-05-21T00:00:00.000Z",
    },
  };

  const { taskContextPackage } = await workspace.applyAppendRequestToCurrentPool(
    appendRequest,
    { currentWorkStage: "task-recommender" },
  );
  const loadedPackages = await workspace.loadExistingTaskContextPackages();

  assert.equal(taskContextPackage.currentWorkStage, "task-recommender");
  assert.equal(
    taskContextPackage.artifacts.executionIntent.body.recommendedPackageId,
    "task-context-package:tasks/task-001.yaml",
  );
  assert.equal(loadedPackages.length, 1);
  assert.deepEqual(loadedPackages[0], taskContextPackage);
});
