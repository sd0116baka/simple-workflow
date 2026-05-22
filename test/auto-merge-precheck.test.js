import { test } from "node:test";
import assert from "node:assert/strict";
import { autoMergeReason } from "../src/workflow/auto-merge-reason.js";
import {
  autoMergeExecutionCheckedInputs,
  autoMergePlanningCheckedInputs,
  executeAutoMergePrecheckReasons,
  planAutoMergePrecheckReasons,
} from "../src/workflow/auto-merge-precheck.js";
import { createAutoMergePackageFixture } from "./support/auto-merge-package-fixtures.js";

test("auto merge planning precheck reports reasons and checked inputs", () => {
  const ready = createAutoMergePackageFixture();
  assert.deepEqual(planAutoMergePrecheckReasons(ready), []);
  assert.deepEqual(autoMergePlanningCheckedInputs(ready), {
    currentWorkStage: "auto-merge-planning",
    hasHumanDecision: true,
    hasConvergenceSuccess: true,
    hasIsolatedWorkspace: true,
  });

  const rejected = createAutoMergePackageFixture({
    stage: "human-decision",
    humanDecision: { decision: "cancel-task" },
    convergenceSuccess: null,
    isolatedWorkspace: null,
  });
  assert.deepEqual(planAutoMergePrecheckReasons(rejected), [
    autoMergeReason("WRONG_STAGE", "任务不在 auto-merge-planning 环节。"),
    autoMergeReason("HUMAN_DECISION_NOT_ACCEPTED", "人工决策没有接受收敛成功。"),
    autoMergeReason("MISSING_CONVERGENCE_SUCCESS", "任务上下文包缺少 convergenceSuccess。"),
    autoMergeReason("MISSING_ISOLATED_WORKSPACE", "任务上下文包缺少 isolatedWorkspace。"),
  ]);
  assert.deepEqual(autoMergePlanningCheckedInputs(rejected), {
    currentWorkStage: "human-decision",
    hasHumanDecision: true,
    hasConvergenceSuccess: false,
    hasIsolatedWorkspace: false,
  });
});

test("auto merge execution precheck reports reasons and checked inputs", () => {
  const plan = {
    source: { worktreePath: ".workflow/worktrees/task-001" },
    target: { branchName: "main", currentCommit: "abc" },
  };
  const ready = createAutoMergePackageFixture({
    stage: "auto-merge-execution",
    autoMergePlan: plan,
  });
  assert.deepEqual(executeAutoMergePrecheckReasons(ready), []);
  assert.deepEqual(autoMergeExecutionCheckedInputs(ready), {
    currentWorkStage: "auto-merge-execution",
    hasAutoMergePlan: true,
    hasIsolatedWorkspace: true,
    hasHumanDecision: true,
  });

  const failed = createAutoMergePackageFixture({
    stage: "auto-merge-planning",
    humanDecision: null,
    isolatedWorkspace: null,
    autoMergePlan: null,
  });
  assert.deepEqual(executeAutoMergePrecheckReasons(failed), [
    autoMergeReason("WRONG_STAGE", "任务不在 auto-merge-execution 环节。"),
    autoMergeReason("MISSING_AUTO_MERGE_PLAN", "任务上下文包缺少 autoMergePlan。"),
    autoMergeReason("MISSING_ISOLATED_WORKSPACE", "任务上下文包缺少 isolatedWorkspace。"),
    autoMergeReason("MISSING_HUMAN_DECISION", "任务上下文包缺少 humanDecision。"),
  ]);
});

test("auto merge prechecks only accept single artifact bodies", () => {
  const malformedPlanning = createAutoMergePackageFixture();
  malformedPlanning.artifacts.humanDecision = [
    { body: { decision: "accept-convergence" } },
  ];
  assert.deepEqual(planAutoMergePrecheckReasons(malformedPlanning), [
    autoMergeReason("MISSING_HUMAN_DECISION", "任务上下文包缺少 humanDecision。"),
  ]);
  assert.equal(autoMergePlanningCheckedInputs(malformedPlanning).hasHumanDecision, false);

  const malformedExecution = createAutoMergePackageFixture({
    stage: "auto-merge-execution",
    autoMergePlan: {
      source: { worktreePath: ".workflow/worktrees/task-001" },
      target: { branchName: "main", currentCommit: "abc" },
    },
  });
  malformedExecution.artifacts.autoMergePlan = [
    { body: malformedExecution.artifacts.autoMergePlan.body },
  ];
  assert.deepEqual(executeAutoMergePrecheckReasons(malformedExecution), [
    autoMergeReason("MISSING_AUTO_MERGE_PLAN", "任务上下文包缺少 autoMergePlan。"),
  ]);
  assert.equal(autoMergeExecutionCheckedInputs(malformedExecution).hasAutoMergePlan, false);
});
