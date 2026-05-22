import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgentCorrectionRound } from "../src/workflow/agent-correction-round.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

function appendRequest(artifactType) {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType,
    artifact: { artifactType },
  };
}

test("agent correction round runs execution, review, and convergence through one stage sequence", async () => {
  const observed = [];
  const applied = [];
  const basePackage = createTaskContextPackageFixture({
    currentWorkStage: "execution-agent",
  });

  const result = await runAgentCorrectionRound({
    taskContextPackage: basePackage,
    runExecutionAgentSession: async () => ({ sessionId: "execution-session" }),
    runReviewAgentSession: async () => ({ sessionId: "review-session" }),
    runConvergenceSession: async () => ({ sessionId: "convergence-session" }),
    runExecution: async ({ taskContextPackage, runAgentSession }) => {
      observed.push(["execution", taskContextPackage.currentWorkStage, await runAgentSession()]);
      return { appendRequest: appendRequest("executionReport"), error: null };
    },
    runReview: async ({ taskContextPackage, runAgentSession }) => {
      observed.push(["review", taskContextPackage.currentWorkStage, await runAgentSession()]);
      return { appendRequest: appendRequest("reviewReport"), error: null };
    },
    runConverge: async ({ taskContextPackage, runAgentSession }) => {
      observed.push(["convergence", taskContextPackage.currentWorkStage, await runAgentSession()]);
      return { appendRequest: appendRequest("convergenceSuccess"), error: null };
    },
    applyAppendRequest: async (request, { currentWorkStage }) => {
      applied.push([request.artifactType, currentWorkStage]);
      return {
        packageId: request.packageId,
        currentWorkStage,
      };
    },
  });

  assert.deepEqual(
    observed.map(([stage, currentWorkStage]) => [stage, currentWorkStage]),
    [
      ["execution", "execution-agent"],
      ["review", "execution-agent"],
      ["convergence", "review-agent"],
    ],
  );
  assert.deepEqual(applied, [
    ["executionReport", "execution-agent"],
    ["reviewReport", "review-agent"],
    ["convergenceSuccess", "convergence"],
  ]);
  assert.equal(result.taskContextPackage.currentWorkStage, "convergence");
  assert.equal(result.executionAgentRun.appendRequest.artifactType, "executionReport");
  assert.equal(result.reviewAgentRun.appendRequest.artifactType, "reviewReport");
  assert.equal(result.convergenceRun.appendRequest.artifactType, "convergenceSuccess");
});

test("agent correction round stops before review when execution fails", async () => {
  const applied = [];
  const result = await runAgentCorrectionRound({
    taskContextPackage: createTaskContextPackageFixture({
      currentWorkStage: "execution-agent",
    }),
    runExecution: async () => ({
      appendRequest: appendRequest("executionReport"),
      error: "execution failed",
    }),
    runReview: async () => {
      throw new Error("review should not run");
    },
    runConverge: async () => {
      throw new Error("convergence should not run");
    },
    applyAppendRequest: async (request, { currentWorkStage }) => {
      applied.push([request.artifactType, currentWorkStage]);
      return {
        packageId: request.packageId,
        currentWorkStage,
      };
    },
  });

  assert.deepEqual(applied, [["executionReport", "execution-agent"]]);
  assert.equal(result.executionAgentRun.error, "execution failed");
  assert.equal(result.reviewAgentRun, null);
  assert.equal(result.convergenceRun, null);
});
