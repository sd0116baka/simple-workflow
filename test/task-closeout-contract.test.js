import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCancelledTaskCloseoutRequest,
  buildMergedTaskCloseoutRequest,
} from "../src/workflow/task-closeout-contract.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

const taskContextPackage = createTaskContextPackageFixture({
  packageId: "task-context-package:tasks/task-003.yaml",
});

test("builds merged task closeout append request", () => {
  const appendRequest = buildMergedTaskCloseoutRequest({
    taskContextPackage,
    closeoutAt: "2026-05-21T10:00:00.000Z",
    worktreePath: ".workflow\\worktrees\\tasks\\task-003",
    branchName: "workflow/tasks/task-003",
  });

  assert.deepEqual(appendRequest, {
    packageId: "task-context-package:tasks/task-003.yaml",
    artifactType: "taskCloseout",
    artifact: {
      closeoutAt: "2026-05-21T10:00:00.000Z",
      closedAt: "2026-05-21T10:00:00.000Z",
      closeoutReason: "merged",
      resultRef: "autoMergeResult",
      cleanup: {
        worktree: {
          path: ".workflow/worktrees/tasks/task-003",
          removed: true,
        },
        branch: {
          name: "workflow/tasks/task-003",
          deleted: true,
        },
      },
      finalStage: "closed",
    },
  });
});

test("builds cancelled task closeout append request", () => {
  const appendRequest = buildCancelledTaskCloseoutRequest({
    taskContextPackage,
    closeoutAt: "2026-05-21T10:05:00.000Z",
    worktreePath: ".workflow\\worktrees\\tasks\\task-003",
    branchName: "workflow/tasks/task-003",
  });

  assert.deepEqual(appendRequest, {
    packageId: "task-context-package:tasks/task-003.yaml",
    artifactType: "taskCloseout",
    artifact: {
      closeoutAt: "2026-05-21T10:05:00.000Z",
      closeoutReason: "cancelled",
      decisionRef: "humanDecision",
      cleanup: {
        worktree: {
          path: ".workflow/worktrees/tasks/task-003",
          removed: true,
        },
        branch: {
          name: "workflow/tasks/task-003",
          deleted: true,
        },
      },
      finalStage: "cancelled",
    },
  });
});
