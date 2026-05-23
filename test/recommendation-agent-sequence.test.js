import { test } from "node:test";
import assert from "node:assert/strict";
import { runRecommendationAgentSequence } from "../src/workflow/recommendation-agent-sequence.js";
import { buildTaskPool } from "../src/workflow/task-pool.js";

function taskPoolFixture() {
  return buildTaskPool([
    {
      id: "task-001",
      fileName: "task-001.yaml",
      parsed: {
        id: "task-001",
        title: "推荐序列",
        type: "feature",
        priority: "normal",
        description: "验证推荐执行序列",
        acceptance: ["可以完成两轮收敛"],
      },
      parseError: null,
      validation: { status: "valid", errors: [] },
    },
  ]);
}

const packageId = "task-context-package:tasks/task-001.yaml";

test("recommendation agent sequence runs a second round after convergence advice", async () => {
  let convergenceCount = 0;
  const result = await runRecommendationAgentSequence({
    taskPool: taskPoolFixture(),
    packageId,
    mainAgentInitialization: {
      appendRequest: {
        agentRun: {
          runId: "main-agent:initialization",
          status: "succeeded",
        },
      },
    },
    runExecution: async () => ({
      appendRequest: {
        packageId,
        artifactType: "executionReport",
        artifact: { status: "succeeded" },
        agentRun: {
          runId: convergenceCount === 0 ? "execution-agent:001" : "execution-agent:002",
          role: "execution",
          sessionId: "execution-session",
          status: "succeeded",
          startedAt: "2026-05-21T00:00:00.000Z",
          finishedAt: "2026-05-21T00:00:00.000Z",
          inputArtifactRefs: [],
          outputArtifactRefs: [],
        },
      },
      error: null,
    }),
    runReview: () => ({
      appendRequest: {
        packageId,
        artifactType: "reviewReport",
        artifact: { outcome: "passed" },
        agentRun: {
          runId: convergenceCount === 0 ? "review-agent:001" : "review-agent:002",
          role: "review",
          sessionId: "review-session",
          status: "succeeded",
          startedAt: "2026-05-21T00:00:00.000Z",
          finishedAt: "2026-05-21T00:00:00.000Z",
          inputArtifactRefs: [],
          outputArtifactRefs: [],
        },
      },
      error: null,
    }),
    runConverge: () => {
      convergenceCount += 1;
      return {
        appendRequest: {
          packageId,
          artifactType: convergenceCount === 1 ? "convergenceAdvice" : "convergenceSuccess",
          artifact: { summary: convergenceCount === 1 ? "继续一轮" : "完成" },
          agentRun: {
            runId: `main-agent:convergence:00${convergenceCount}`,
            role: "main",
            sessionId: "main-session",
            status: "succeeded",
            startedAt: "2026-05-21T00:00:00.000Z",
            finishedAt: "2026-05-21T00:00:00.000Z",
            inputArtifactRefs: [],
            outputArtifactRefs: [],
          },
        },
        error: null,
      };
    },
    now: () => "2026-05-21T00:00:00.000Z",
  });

  assert.equal(result.executionAgentRuns.length, 2);
  assert.equal(result.reviewAgentRuns.length, 2);
  assert.equal(result.convergenceRuns.length, 2);
  assert.equal(result.successHumanDecisionRequest.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(result.failureHumanDecisionRequest, null);
  assert.equal(result.taskContextPackage.currentWorkStage, "human-decision");
  assert.equal(result.taskContextPackage.artifacts.convergenceAdvice[0].artifactId, "convergenceAdvice:001");
  assert.equal(result.taskContextPackage.artifacts.convergenceSuccess.artifactId, "convergenceSuccess");
});

test("recommendation agent sequence stops before review when execution fails", async () => {
  const result = await runRecommendationAgentSequence({
    taskPool: taskPoolFixture(),
    packageId,
    mainAgentInitialization: {
      appendRequest: {
        agentRun: {
          runId: "main-agent:initialization",
          status: "succeeded",
        },
      },
    },
    runExecution: async () => ({
      appendRequest: {
        packageId,
        artifactType: "executionReport",
        artifact: { status: "failed" },
        agentRun: {
          runId: "execution-agent:001",
          role: "execution",
          sessionId: "execution-session",
          status: "failed",
          startedAt: "2026-05-21T00:00:00.000Z",
          finishedAt: "2026-05-21T00:00:00.000Z",
          inputArtifactRefs: [],
          outputArtifactRefs: [],
        },
      },
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
  assert.equal(result.taskContextPackage.currentWorkStage, "execution-agent");
});
