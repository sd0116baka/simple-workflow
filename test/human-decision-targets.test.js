import { test } from "node:test";
import assert from "node:assert/strict";
import {
  humanDecisionArtifactByType,
  humanDecisionRequestMatchesTarget,
  latestHumanDecisionTarget,
} from "../src/workflow/human-decision-targets.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

function artifact(artifactId, body = {}) {
  return { artifactId, body, appendedAt: "2026-05-21T10:00:00.000Z" };
}

function taskPackage({
  targetType = "convergenceSuccess",
  requestTargetType = null,
  requestTargetRef = null,
} = {}) {
  const artifacts = {
    convergenceSuccess: artifact("convergenceSuccess", { summary: "完成" }),
    convergenceFailure: [
      artifact("convergenceFailure:001", { summary: "旧失败" }),
      artifact("convergenceFailure:002", { summary: "新失败" }),
    ],
    autoMergeFailure: artifact("autoMergeFailure", { reasons: [] }),
    isolatedWorkspace: artifact("isolatedWorkspace", {
      worktreePath: ".workflow/worktrees/tasks/task-001",
      branchName: "workflow/tasks/task-001",
      baseCommit: "base",
    }),
  };

  if (targetType === "convergenceSuccess") {
    artifacts.humanDecisionRequest = artifact("humanDecisionRequest", {
      convergenceSuccessRef: "convergenceSuccess",
      decisionOptions: ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"],
    });
  } else {
    artifacts.humanDecisionRequest = artifact("humanDecisionRequest", {
      targetType: requestTargetType ?? targetType,
      targetRef: requestTargetRef ?? targetType,
      decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
    });
  }

  return createTaskContextPackageFixture({
    currentWorkStage: "human-decision",
    artifacts,
  });
}

test("human decision targets resolve the current request target", () => {
  const successPackage = taskPackage();
  const successTarget = latestHumanDecisionTarget(successPackage);
  assert.equal(successTarget.kind, "convergenceSuccess");
  assert.equal(successTarget.artifact.artifactId, "convergenceSuccess");
  assert.equal(humanDecisionRequestMatchesTarget(
    successPackage.artifacts.humanDecisionRequest,
    successTarget,
  ), true);

  const failurePackage = taskPackage({
    targetType: "convergenceFailure",
    requestTargetType: null,
    requestTargetRef: "convergenceFailure:002",
  });
  const failureTarget = latestHumanDecisionTarget(failurePackage);
  assert.equal(failureTarget.kind, "convergenceFailure");
  assert.equal(failureTarget.artifact.artifactId, "convergenceFailure:002");
  assert.equal(humanDecisionRequestMatchesTarget(
    failurePackage.artifacts.humanDecisionRequest,
    failureTarget,
  ), true);

  const autoMergeTarget = latestHumanDecisionTarget(taskPackage({
    targetType: "autoMergeFailure",
  }));
  assert.equal(autoMergeTarget.kind, "autoMergeFailure");
  assert.equal(autoMergeTarget.artifact.artifactId, "autoMergeFailure");
});

test("human decision targets return latest multi artifact records by type", () => {
  const taskContextPackage = taskPackage({
    targetType: "convergenceFailure",
    requestTargetType: null,
    requestTargetRef: "convergenceFailure:002",
  });

  assert.equal(
    humanDecisionArtifactByType(taskContextPackage, "convergenceFailure").artifactId,
    "convergenceFailure:002",
  );
  assert.equal(
    humanDecisionArtifactByType(taskContextPackage, "autoMergeFailure").artifactId,
    "autoMergeFailure",
  );
});

test("human decision targets only accept single artifact records for single artifact targets", () => {
  const taskContextPackage = taskPackage();
  delete taskContextPackage.artifacts.convergenceFailure;
  taskContextPackage.artifacts.convergenceSuccess = [
    artifact("convergenceSuccess", { summary: "完成" }),
  ];
  taskContextPackage.artifacts.autoMergeFailure = [
    artifact("autoMergeFailure", { reasons: [] }),
  ];

  assert.equal(latestHumanDecisionTarget(taskContextPackage), null);
  assert.equal(humanDecisionArtifactByType(taskContextPackage, "autoMergeFailure"), null);
});
