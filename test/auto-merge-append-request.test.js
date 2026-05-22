import { test } from "node:test";
import assert from "node:assert/strict";
import { autoMergeReason } from "../src/workflow/auto-merge-reason.js";
import {
  buildAutoMergeFailureRequest,
  buildAutoMergePlanRequest,
  buildAutoMergeRejectionRequest,
  buildAutoMergeResultRequest,
} from "../src/workflow/auto-merge-append-request.js";
import { createAutoMergePackageFixture } from "./support/auto-merge-package-fixtures.js";

test("auto merge append requests build rejection and failure artifacts", () => {
  const planningPackage = createAutoMergePackageFixture({ isolatedWorkspace: null });
  assert.deepEqual(buildAutoMergeRejectionRequest({
    taskContextPackage: planningPackage,
    reasons: [autoMergeReason("WORKTREE_MISSING", "隔离工作树不存在。")],
    now: () => "2026-05-21T10:00:00.000Z",
  }), {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType: "autoMergeRejection",
    artifact: {
      rejectedAt: "2026-05-21T10:00:00.000Z",
      decisionRef: "humanDecision",
      reasons: [autoMergeReason("WORKTREE_MISSING", "隔离工作树不存在。")],
      checkedInputs: {
        currentWorkStage: "auto-merge-planning",
        hasHumanDecision: true,
        hasConvergenceSuccess: true,
        hasIsolatedWorkspace: false,
      },
    },
  });

  const executionPackage = createAutoMergePackageFixture({
    stage: "auto-merge-execution",
    autoMergePlan: { source: {}, target: {} },
  });
  assert.deepEqual(buildAutoMergeFailureRequest({
    taskContextPackage: executionPackage,
    reasons: [autoMergeReason("TARGET_MOVED", "目标分支已经不在自动合并计划记录的 commit。")],
    now: () => "2026-05-21T10:05:00.000Z",
  }), {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType: "autoMergeFailure",
    artifact: {
      failedAt: "2026-05-21T10:05:00.000Z",
      planRef: "autoMergePlan",
      reasons: [autoMergeReason("TARGET_MOVED", "目标分支已经不在自动合并计划记录的 commit。")],
      checkedInputs: {
        currentWorkStage: "auto-merge-execution",
        hasAutoMergePlan: true,
        hasIsolatedWorkspace: true,
        hasHumanDecision: true,
      },
    },
  });
});

test("auto merge append requests build plan and result artifacts", () => {
  const packageUnderMerge = createAutoMergePackageFixture();
  assert.deepEqual(buildAutoMergePlanRequest({
    taskContextPackage: packageUnderMerge,
    plannedAt: "2026-05-21T10:00:00.000Z",
    source: {
      worktreePath: ".workflow/worktrees/task-001",
      branchName: "workflow/task-001",
      baseCommit: "base",
      currentCommit: "head",
    },
    target: {
      branchName: "main",
      currentCommit: "target",
    },
    changedFiles: ["src/file.js"],
    worktreeHeadMatchesAcceptedBase: false,
  }), {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType: "autoMergePlan",
    artifact: {
      plannedAt: "2026-05-21T10:00:00.000Z",
      decisionRef: "humanDecision",
      source: {
        worktreePath: ".workflow/worktrees/task-001",
        branchName: "workflow/task-001",
        baseCommit: "base",
        currentCommit: "head",
      },
      target: {
        branchName: "main",
        currentCommit: "target",
      },
      changeSet: {
        changedFiles: ["src/file.js"],
      },
      checks: [
        { name: "humanDecisionAccepted", passed: true },
        { name: "worktreeExists", passed: true },
        { name: "worktreeHeadMatchesAcceptedBase", passed: false },
        { name: "worktreeContainsAcceptedWork", passed: true },
        { name: "targetBranchAvailable", passed: true },
      ],
    },
  });

  assert.deepEqual(buildAutoMergeResultRequest({
    taskContextPackage: packageUnderMerge,
    mergedAt: "2026-05-21T10:05:00.000Z",
    source: {
      worktreePath: ".workflow/worktrees/task-001",
      branchName: "workflow/task-001",
      baseCommit: "base",
      commit: "source",
    },
    target: {
      branchName: "main",
      beforeCommit: "target-before",
      afterCommit: "target-after",
    },
    changedFiles: ["src/file.js"],
    sourceRebased: true,
  }), {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType: "autoMergeResult",
    artifact: {
      mergedAt: "2026-05-21T10:05:00.000Z",
      planRef: "autoMergePlan",
      source: {
        worktreePath: ".workflow/worktrees/task-001",
        branchName: "workflow/task-001",
        baseCommit: "base",
        commit: "source",
      },
      target: {
        branchName: "main",
        beforeCommit: "target-before",
        afterCommit: "target-after",
      },
      changeSet: {
        changedFiles: ["src/file.js"],
      },
      checks: [
        { name: "mainWorktreeClean", passed: true },
        { name: "targetStillAtPlannedCommit", passed: true },
        { name: "sourceCommitted", passed: true },
        { name: "sourceRebasedOntoTarget", passed: true },
        { name: "mergedFastForward", passed: true },
      ],
    },
  });
});
