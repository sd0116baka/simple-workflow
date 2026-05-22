import { test } from "node:test";
import assert from "node:assert/strict";
import {
  branchNameFromSafePackageId,
  buildIsolatedWorkspaceRequest,
  isolatedWorkspaceNamingFor,
  safePackageIdFromSourcePath,
  worktreePathFromSafePackageId,
} from "../src/workflow/isolated-workspace-contract.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

const taskContextPackage = createTaskContextPackageFixture({
  packageId: "task-context-package:tasks/Feature Task 003.yaml",
  source: {
    path: "tasks/Feature Task 003.yaml",
  },
});

test("derives isolated workspace names from task source path", () => {
  assert.equal(safePackageIdFromSourcePath("tasks/Feature Task 003.yaml"), "tasks-feature-task-003");
  assert.equal(worktreePathFromSafePackageId("tasks-feature-task-003"), ".workflow/worktrees/tasks/tasks-feature-task-003");
  assert.equal(branchNameFromSafePackageId("tasks-feature-task-003"), "workflow/tasks/tasks-feature-task-003");
  assert.deepEqual(isolatedWorkspaceNamingFor(taskContextPackage), {
    safePackageId: "tasks-feature-task-003",
    worktreePath: ".workflow/worktrees/tasks/tasks-feature-task-003",
    branchName: "workflow/tasks/tasks-feature-task-003",
  });
});

test("builds isolated workspace append request with normalized path", () => {
  const appendRequest = buildIsolatedWorkspaceRequest({
    taskContextPackage,
    worktreePath: ".workflow\\worktrees\\tasks\\tasks-feature-task-003",
    branchName: "workflow/tasks/tasks-feature-task-003",
    baseBranch: "main",
    baseCommit: "a".repeat(40),
  });

  assert.deepEqual(appendRequest, {
    packageId: "task-context-package:tasks/Feature Task 003.yaml",
    artifactType: "isolatedWorkspace",
    artifact: {
      worktreePath: ".workflow/worktrees/tasks/tasks-feature-task-003",
      branchName: "workflow/tasks/tasks-feature-task-003",
      baseBranch: "main",
      baseCommit: "a".repeat(40),
      status: "ready",
    },
  });
});
