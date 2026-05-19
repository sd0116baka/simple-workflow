import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateIsolatedWorkspace } from "../src/workflow/isolated-workspace-flow.js";

function authorizedPackage() {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    source: {
      path: "tasks/task-003.yaml",
    },
    artifacts: {
      executionAuthorization: {
        artifactId: "executionAuthorization",
        body: {},
        appendedAt: "2026-05-18T09:01:00.000Z",
      },
    },
  };
}

test("allocates a task-scoped isolated workspace stub", () => {
  const result = allocateIsolatedWorkspace({
    taskContextPackage: authorizedPackage(),
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "isolatedWorkspace");
  assert.deepEqual(result.appendRequest.artifact, {
    worktreePath: ".workflow/worktrees/tasks/tasks-task-003",
    branchName: "workflow/tasks/tasks-task-003",
    baseBranch: "main",
    baseCommit: "stub-base-commit",
    status: "ready",
  });
});

test("does not allocate isolated workspace before execution authorization", () => {
  const taskPackage = authorizedPackage();
  delete taskPackage.artifacts.executionAuthorization;

  const result = allocateIsolatedWorkspace({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少执行授权/);
});
