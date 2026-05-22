import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStateFixturePackage } from "./support/state-fixture-package-fixtures.js";

test("state fixture package builder creates convergence failure human decision package", () => {
  const taskContextPackage = buildStateFixturePackage({
    fixtureKey: "convergence-failure",
    baseCommit: "abc1234",
  });

  assert.equal(taskContextPackage.packageId, "task-context-package:tasks/stub-convergence-failure.yaml");
  assert.equal(taskContextPackage.currentWorkStage, "human-decision");
  assert.equal(taskContextPackage.fixture.baseCommit, "abc1234");
  assert.equal(taskContextPackage.artifacts.convergenceFailure[0].artifactId, "convergenceFailure:001");
  assert.equal(
    taskContextPackage.artifacts.humanDecisionRequest.body.targetRef,
    "convergenceFailure:001",
  );
  assert.deepEqual(taskContextPackage.artifacts.humanDecisionRequest.body.decisionOptions, [
    "continue-convergence-with-guidance",
    "cancel-task",
  ]);
});

test("state fixture package builder creates human guided execution trace", () => {
  const taskContextPackage = buildStateFixturePackage({
    fixtureKey: "human-guided-execution",
    baseCommit: "def5678",
  });

  assert.equal(taskContextPackage.currentWorkStage, "execution-agent");
  assert.equal(taskContextPackage.artifacts.humanConvergenceGuidance[0].artifactId, "humanConvergenceGuidance:001");
  assert.equal(
    taskContextPackage.artifacts.humanConvergenceGuidance[0].body.decidedAt,
    "2026-05-21T00:00:00.000Z",
  );
  assert.equal(taskContextPackage.agentRuns.at(-1).runId, "execution-agent:002");
  assert.equal(taskContextPackage.agentRuns.at(-1).status, "running");
  assert.deepEqual(
    taskContextPackage.agentRuns.at(-1).inputArtifactRefs,
    [
      "taskDraft",
      "executionIntent",
      "executionAuthorization",
      "convergenceFailure:001",
      "humanConvergenceGuidance:001",
      "isolatedWorkspace",
    ],
  );
});

test("state fixture package builder preserves failed review findings for human decision trace", () => {
  const taskContextPackage = buildStateFixturePackage({
    fixtureKey: "convergence-failure",
    baseCommit: "badc0de",
  });

  assert.deepEqual(taskContextPackage.artifacts.reviewReport[0].body, {
    outcome: "failed",
    summary: "fixture review report",
    findings: [
      { code: "fixture-not-converged", message: "用于测试收敛失败人工处理。" },
    ],
  });
  assert.deepEqual(taskContextPackage.artifacts.convergenceFailure[0].body, {
    summary: "fixture convergence failure",
    reasonCode: "fixture-not-converged",
    basisRefs: ["executionReport:001", "reviewReport:001"],
    attemptedFixes: [],
    unresolvedIssues: [
      { code: "fixture-not-converged", message: "用于测试收敛失败人工处理。" },
    ],
    humanDecisionQuestion: "提供人工收敛意见继续，或取消任务。",
    maxIterations: 1,
    completedIterations: 1,
  });
});
