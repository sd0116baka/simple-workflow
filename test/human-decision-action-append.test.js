import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAcceptConvergenceDecisionRequest,
  buildCancelTaskDecisionRequest,
  buildHumanConvergenceGuidanceRequest,
} from "../src/workflow/human-decision-action-append.js";
import { createHumanDecisionPackageFixture } from "./support/human-decision-package-fixtures.js";

test("human decision action append module builds guidance, accept, and cancel artifacts", () => {
  const taskContextPackage = createHumanDecisionPackageFixture();
  const decisionTarget = {
    kind: "convergenceSuccess",
    artifact: taskContextPackage.artifacts.convergenceSuccess,
  };

  assert.deepEqual(buildHumanConvergenceGuidanceRequest({
    taskContextPackage,
    decisionTarget,
    guidance: "  继续验证边界  ",
    focusAreas: ["状态", "  "],
    avoidRepeating: "不要重复旧方案",
    expectedNextOutcome: "  完成收敛  ",
    decidedAt: "2026-05-21T10:04:00.000Z",
  }).artifact, {
    decision: "continue-convergence-with-guidance",
    targetType: "convergenceSuccess",
    targetRef: "convergenceSuccess",
    decidedAt: "2026-05-21T10:04:00.000Z",
    guidance: "继续验证边界",
    focusAreas: ["状态"],
    avoidRepeating: ["不要重复旧方案"],
    expectedNextOutcome: "完成收敛",
    nextRequiredStage: "convergence",
  });

  assert.deepEqual(buildAcceptConvergenceDecisionRequest({
    taskContextPackage,
    convergenceSuccess: taskContextPackage.artifacts.convergenceSuccess,
    isolatedWorkspace: taskContextPackage.artifacts.isolatedWorkspace,
    worktreeSnapshot: { cwd: ".workflow/worktrees/tasks/task-001", changedFiles: ["a.js"] },
    decidedAt: "2026-05-21T10:05:00.000Z",
  }).artifact, {
    decision: "accept-convergence",
    decidedAt: "2026-05-21T10:05:00.000Z",
    convergenceSuccessRef: "convergenceSuccess",
    acceptedWork: {
      isolatedWorkspaceRef: "isolatedWorkspace",
      worktreePath: ".workflow/worktrees/tasks/task-001",
      branchName: "workflow/tasks/task-001",
      baseCommit: "base",
    },
    worktreeSnapshot: {
      cwd: ".workflow/worktrees/tasks/task-001",
      changedFiles: ["a.js"],
    },
    nextRequiredStage: "auto-merge-planning",
  });

  assert.deepEqual(buildCancelTaskDecisionRequest({
    taskContextPackage,
    decisionTarget,
    decidedAt: "2026-05-21T10:06:00.000Z",
  }).artifact, {
    decision: "cancel-task",
    decidedAt: "2026-05-21T10:06:00.000Z",
    targetType: "convergenceSuccess",
    targetRef: "convergenceSuccess",
    nextRequiredStage: "task-closeout",
  });
});
