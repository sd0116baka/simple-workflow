import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStateFixturePackage } from "./support/state-fixture-package-fixtures.js";

test("state fixture package builder reuses workflow contract shape for execution report trace", () => {
  const taskContextPackage = buildStateFixturePackage({
    fixtureKey: "execution-agent",
    baseCommit: "eec001",
  });

  assert.equal(taskContextPackage.currentWorkStage, "execution-agent");
  assert.deepEqual(taskContextPackage.artifacts.executionIntent.body, {
    recommendedPackageId: "task-context-package:tasks/stub-execution-agent.yaml",
    confidence: "low",
    selectionReasoning: ["测试状态种子生成。"],
    candidateComparison: [
      {
        packageId: "task-context-package:tasks/stub-execution-agent.yaml",
        decision: "selected",
        reason: "状态桩目标任务。",
      },
    ],
    executionBrief: {
      goalInterpretation: "用于测试 execution-agent 环节展示。",
      expectedOutcome: ["页面可以展示 execution-agent 状态"],
      implementationHints: [],
      riskSignals: [],
      openQuestions: [],
    },
  });
  assert.deepEqual(taskContextPackage.artifacts.executionAuthorization.body, {
    authorizedAt: "2026-05-21T00:00:00.000Z",
    task: {
      id: "stub-execution-agent",
      name: "Stub execution-agent",
      goal: "用于测试 execution-agent 环节展示。",
      acceptanceCriteria: ["页面可以展示 execution-agent 状态"],
    },
    runtimeSnapshot: {
      activeWork: null,
      worktree: {
        clean: true,
        changedFiles: [],
      },
    },
    termination: {
      maxIterations: 2,
    },
  });
  assert.deepEqual(taskContextPackage.artifacts.isolatedWorkspace.body, {
    worktreePath: ".workflow/worktrees/tasks/stub-execution-agent",
    branchName: "workflow/tasks/stub-execution-agent",
    baseBranch: "main",
    baseCommit: "eec001",
    status: "ready",
  });
  assert.deepEqual(taskContextPackage.artifacts.executionReport[0].body, {
    summary: "fixture execution report",
    status: "succeeded",
    cwd: ".workflow/worktrees/tasks/stub-execution-agent",
    changedFiles: ["fixtures/stub-execution-agent.txt"],
    tests: [],
    notes: [],
    rawOutput: null,
  });
  assert.deepEqual(taskContextPackage.agentRuns[0], {
    runId: "main-agent:initialization",
    role: "main",
    sessionId: "fixture-main:stub-execution-agent",
    inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization"],
    outputArtifactRefs: [],
    status: "succeeded",
    startedAt: "2026-05-21T00:00:00.000Z",
    finishedAt: "2026-05-21T00:00:00.000Z",
  });
  assert.deepEqual(taskContextPackage.agentRuns.at(-1), {
    runId: "execution-agent:001",
    role: "execution",
    sessionId: "fixture-execution:stub-execution-agent",
    inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization", "isolatedWorkspace"],
    outputArtifactRefs: ["executionReport:001"],
    status: "succeeded",
    startedAt: "2026-05-21T00:00:00.000Z",
    finishedAt: "2026-05-21T00:00:00.000Z",
  });
});

test("state fixture package builder reuses workflow contract shape for review report trace", () => {
  const taskContextPackage = buildStateFixturePackage({
    fixtureKey: "review-agent",
    baseCommit: "bada55",
  });

  assert.equal(taskContextPackage.currentWorkStage, "review-agent");
  assert.deepEqual(taskContextPackage.artifacts.reviewReport[0].body, {
    outcome: "passed",
    summary: "fixture review report",
    findings: [],
  });
  assert.deepEqual(taskContextPackage.agentRuns.at(-1), {
    runId: "review-agent:001",
    role: "review",
    sessionId: "fixture-review:stub-review-agent",
    inputArtifactRefs: ["taskDraft", "executionAuthorization", "isolatedWorkspace", "executionReport:001"],
    outputArtifactRefs: ["reviewReport:001"],
    status: "succeeded",
    startedAt: "2026-05-21T00:00:00.000Z",
    finishedAt: "2026-05-21T00:00:00.000Z",
  });
});
