import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAutoMergeIssueDecisionRequest,
  buildConvergenceFailureDecisionRequest,
  buildConvergenceSuccessDecisionRequest,
} from "../src/workflow/human-decision-request-append.js";
import {
  createHumanDecisionPackageFixture,
  humanDecisionArtifact,
} from "./support/human-decision-package-fixtures.js";

test("human decision request append module builds request artifacts", () => {
  const taskContextPackage = createHumanDecisionPackageFixture();
  assert.deepEqual(buildConvergenceSuccessDecisionRequest({
    taskContextPackage,
    convergenceSuccess: taskContextPackage.artifacts.convergenceSuccess,
    requestedAt: "2026-05-21T10:01:00.000Z",
  }), {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType: "humanDecisionRequest",
    artifact: {
      requestedAt: "2026-05-21T10:01:00.000Z",
      reason: "Agent 已产出 convergenceSuccess，需要人工决定是否接受收敛成功。",
      convergenceSuccessRef: "convergenceSuccess",
      decisionOptions: [
        "accept-convergence",
        "continue-convergence-with-guidance",
        "cancel-task",
      ],
    },
  });

  assert.deepEqual(buildConvergenceFailureDecisionRequest({
    taskContextPackage,
    convergenceFailure: humanDecisionArtifact("convergenceFailure:002"),
    requestedAt: "2026-05-21T10:02:00.000Z",
  }).artifact, {
    requestedAt: "2026-05-21T10:02:00.000Z",
    reason: "任务当前无法自动收敛，需要人工提供收敛意见或取消任务。",
    targetRef: "convergenceFailure:002",
    decisionOptions: [
      "continue-convergence-with-guidance",
      "cancel-task",
    ],
  });

  assert.deepEqual(buildAutoMergeIssueDecisionRequest({
    taskContextPackage,
    artifactType: "autoMergeFailure",
    targetArtifact: taskContextPackage.artifacts.autoMergeFailure,
    requestedAt: "2026-05-21T10:03:00.000Z",
  }).artifact, {
    requestedAt: "2026-05-21T10:03:00.000Z",
    reason: "自动合并无法继续，需要人工提供收敛意见或取消任务。",
    targetType: "autoMergeFailure",
    targetRef: "autoMergeFailure",
    decisionOptions: [
      "continue-convergence-with-guidance",
      "cancel-task",
    ],
  });
});
