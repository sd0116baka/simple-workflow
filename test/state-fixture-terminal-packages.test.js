import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStateFixturePackage } from "./support/state-fixture-package-fixtures.js";
import {
  artifactRecord,
  latestArtifactRecord,
} from "../src/workflow/task-package-artifacts.js";

test("state fixture package builder reuses workflow contract shapes for accepted auto merge trace", () => {
  const taskContextPackage = buildStateFixturePackage({
    fixtureKey: "merged",
    baseCommit: "face456",
  });

  assert.equal(taskContextPackage.currentWorkStage, "merged");
  assert.deepEqual(taskContextPackage.artifacts.humanDecision.body.acceptedWork, {
    isolatedWorkspaceRef: "isolatedWorkspace",
    worktreePath: ".workflow/worktrees/tasks/stub-merged",
    branchName: "workflow/tasks/stub-merged",
    baseCommit: "face456",
  });
  assert.deepEqual(taskContextPackage.artifacts.autoMergePlan.body.checks, [
    { name: "humanDecisionAccepted", passed: true },
    { name: "worktreeExists", passed: true },
    { name: "worktreeHeadMatchesAcceptedBase", passed: true },
    { name: "worktreeContainsAcceptedWork", passed: true },
    { name: "targetBranchAvailable", passed: true },
  ]);
  assert.equal(taskContextPackage.artifacts.autoMergeResult.body.planRef, "autoMergePlan");
  assert.equal(
    taskContextPackage.artifacts.autoMergeResult.body.source.worktreePath,
    ".workflow/worktrees/tasks/stub-merged",
  );
  assert.deepEqual(
    taskContextPackage.artifacts.autoMergeResult.body.changeSet.changedFiles,
    ["fixtures/stub-merged.txt"],
  );
  assert.deepEqual(
    taskContextPackage.timeline
      .filter((event) => event.artifactType?.startsWith("autoMerge"))
      .map((event) => event.artifactType),
    ["autoMergePlan", "autoMergeResult"],
  );
});

test("state fixture package builder exposes fixture trace through artifact accessors", () => {
  const taskContextPackage = buildStateFixturePackage({
    fixtureKey: "merged",
    baseCommit: "face999",
  });

  assert.equal(latestArtifactRecord(taskContextPackage, "executionReport").artifactId, "executionReport:001");
  assert.equal(latestArtifactRecord(taskContextPackage, "reviewReport").artifactId, "reviewReport:001");
  assert.equal(latestArtifactRecord(taskContextPackage, "convergenceAdvice").artifactId, "convergenceAdvice:001");
  assert.equal(artifactRecord(taskContextPackage, "convergenceSuccess").artifactId, "convergenceSuccess");
  assert.equal(artifactRecord(taskContextPackage, "humanDecision").body.decision, "accept-convergence");
  assert.deepEqual(artifactRecord(taskContextPackage, "autoMergePlan").body.changeSet.changedFiles, [
    "fixtures/stub-merged.txt",
  ]);
  assert.equal(artifactRecord(taskContextPackage, "autoMergeResult").body.planRef, "autoMergePlan");
});

test("state fixture package builder reuses workflow contract shape for closed closeout trace", () => {
  const taskContextPackage = buildStateFixturePackage({
    fixtureKey: "closed",
    baseCommit: "bead777",
  });

  assert.equal(taskContextPackage.currentWorkStage, "closed");
  assert.deepEqual(taskContextPackage.artifacts.taskCloseout.body, {
    closeoutAt: "2026-05-21T00:00:00.000Z",
    closedAt: "2026-05-21T00:00:00.000Z",
    closeoutReason: "merged",
    resultRef: "autoMergeResult",
    cleanup: {
      worktree: {
        path: ".workflow/worktrees/tasks/stub-closed",
        removed: true,
      },
      branch: {
        name: "workflow/tasks/stub-closed",
        deleted: true,
      },
    },
    finalStage: "closed",
  });
});

test("state fixture package builder creates cancelled closeout trace", () => {
  const taskContextPackage = buildStateFixturePackage({
    fixtureKey: "cancelled",
    baseCommit: "cafe123",
  });

  assert.equal(taskContextPackage.currentWorkStage, "cancelled");
  assert.deepEqual(Object.keys(taskContextPackage.artifacts), [
    "convergenceFailure",
    "humanDecisionRequest",
    "humanDecision",
    "taskCloseout",
  ]);
  assert.equal(taskContextPackage.agentRuns.length, 0);
  assert.equal(taskContextPackage.artifacts.humanDecision.body.decision, "cancel-task");
  assert.deepEqual(taskContextPackage.artifacts.taskCloseout.body, {
    closeoutAt: "2026-05-21T00:00:00.000Z",
    closeoutReason: "cancelled",
    decisionRef: "humanDecision",
    cleanup: {
      worktree: {
        path: ".workflow/worktrees/tasks/stub-cancelled",
        removed: true,
      },
      branch: {
        name: "workflow/tasks/stub-cancelled",
        deleted: true,
      },
    },
    finalStage: "cancelled",
  });
  assert.deepEqual(
    taskContextPackage.timeline.map((event) => event.artifactType),
    ["convergenceFailure", "humanDecisionRequest", "humanDecision", "taskCloseout"],
  );
});
