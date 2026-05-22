import { test } from "node:test";
import assert from "node:assert/strict";
import { runRecommendationAgentRounds } from "../src/workflow/recommendation-agent-rounds.js";
import { buildTaskPool } from "../src/workflow/task-pool.js";

function taskPoolFixture() {
  return buildTaskPool([
    {
      id: "task-001",
      fileName: "task-001.yaml",
      parsed: {
        id: "task-001",
        title: "推荐 round loop",
        type: "feature",
        priority: "normal",
        description: "验证推荐 round loop",
        acceptance: ["可以完成两轮收敛"],
      },
      parseError: null,
      validation: { status: "valid", errors: [] },
    },
  ]);
}

const packageId = "task-context-package:tasks/task-001.yaml";

function agentRun(runId, role = "main") {
  return {
    runId,
    role,
    sessionId: `${runId}:session`,
    status: "succeeded",
    startedAt: "2026-05-22T00:00:00.000Z",
    finishedAt: "2026-05-22T00:00:00.000Z",
    inputArtifactRefs: [],
    outputArtifactRefs: [],
  };
}

function appendRequest(artifactType, runId) {
  return {
    packageId,
    artifactType,
    artifact: { summary: artifactType },
    agentRun: agentRun(runId),
  };
}

test("recommendation agent rounds return an empty result before main initialization", async () => {
  const taskPool = taskPoolFixture();
  const result = await runRecommendationAgentRounds({
    taskPool,
    packageId,
    mainAgentInitialization: null,
    runCorrectionRound() {
      throw new Error("rounds should not run before main initialization");
    },
  });

  assert.equal(result.taskPool, taskPool);
  assert.equal(result.taskContextPackage.packageId, packageId);
  assert.deepEqual(result.executionAgentRuns, []);
  assert.deepEqual(result.reviewAgentRuns, []);
  assert.deepEqual(result.convergenceRuns, []);
  assert.equal(result.terminalConvergenceRun, null);
});

test("recommendation agent rounds run a second round after convergence advice", async () => {
  let convergenceCount = 0;
  const result = await runRecommendationAgentRounds({
    taskPool: taskPoolFixture(),
    packageId,
    mainAgentInitialization: {
      appendRequest: {
        agentRun: agentRun("main-agent:initialization"),
      },
    },
    runExecution: async () => ({
      appendRequest: appendRequest(
        "executionReport",
        convergenceCount === 0 ? "execution-agent:001" : "execution-agent:002",
      ),
      error: null,
    }),
    runReview: () => ({
      appendRequest: appendRequest(
        "reviewReport",
        convergenceCount === 0 ? "review-agent:001" : "review-agent:002",
      ),
      error: null,
    }),
    runConverge: () => {
      convergenceCount += 1;
      return {
        appendRequest: appendRequest(
          convergenceCount === 1 ? "convergenceAdvice" : "convergenceSuccess",
          `main-agent:convergence:00${convergenceCount}`,
        ),
        error: null,
      };
    },
  });

  assert.equal(result.executionAgentRuns.length, 2);
  assert.equal(result.reviewAgentRuns.length, 2);
  assert.equal(result.convergenceRuns.length, 2);
  assert.equal(result.terminalConvergenceRun.appendRequest.artifactType, "convergenceSuccess");
  assert.equal(result.taskContextPackage.currentWorkStage, "convergence");
  assert.equal(result.taskContextPackage.artifacts.convergenceAdvice[0].artifactId, "convergenceAdvice:001");
  assert.equal(result.taskContextPackage.artifacts.convergenceSuccess.artifactId, "convergenceSuccess");
});

test("recommendation agent rounds stop without a terminal convergence run when execution fails", async () => {
  const result = await runRecommendationAgentRounds({
    taskPool: taskPoolFixture(),
    packageId,
    mainAgentInitialization: {
      appendRequest: {
        agentRun: agentRun("main-agent:initialization"),
      },
    },
    runExecution: async () => ({
      appendRequest: appendRequest("executionReport", "execution-agent:001"),
      error: "execution failed",
    }),
    runReview: () => {
      throw new Error("review should not run");
    },
  });

  assert.equal(result.executionAgentRuns.length, 1);
  assert.equal(result.executionAgentRuns[0].error, "execution failed");
  assert.deepEqual(result.reviewAgentRuns, []);
  assert.deepEqual(result.convergenceRuns, []);
  assert.equal(result.terminalConvergenceRun, null);
  assert.equal(result.taskContextPackage.currentWorkStage, "execution-agent");
});
