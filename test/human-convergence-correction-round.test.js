import { test } from "node:test";
import assert from "node:assert/strict";
import { runHumanConvergenceCorrectionRound } from "../src/workflow/human-convergence-correction-round.js";

function packageFixture() {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "execution-agent",
    taskDraft: { id: "task-001", name: "测试任务" },
    artifacts: {},
    agentRuns: [],
    timeline: [],
  };
}

function createRecommendationRun(taskContextPackage = packageFixture()) {
  return {
    taskContextPackage,
    executionAgentRuns: [],
    executionAgentErrors: [],
    reviewAgentRuns: [],
    reviewAgentErrors: [],
    convergenceRuns: [],
    convergenceErrors: [],
  };
}

function appendRequest(artifactType, artifact = {}) {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType,
    artifact,
  };
}

function createAppendRecorder(recommendationRun) {
  const calls = [];
  return {
    calls,
    applyAppendRequest: async (request, { currentWorkStage }) => {
      calls.push({ appendRequest: request, currentWorkStage });
      recommendationRun.taskContextPackage = {
        ...recommendationRun.taskContextPackage,
        currentWorkStage,
        artifacts: {
          ...recommendationRun.taskContextPackage.artifacts,
          [request.artifactType]: {
            artifactId: request.artifactType,
            body: request.artifact,
            appendedAt: request.artifact.appendedAt ?? "2026-05-22T00:00:00.000Z",
          },
        },
      };
      return recommendationRun.taskContextPackage;
    },
  };
}

test("human convergence correction round records runs and requests terminal human decision", async () => {
  const recommendationRun = createRecommendationRun();
  const { applyAppendRequest, calls } = createAppendRecorder(recommendationRun);
  const executionRun = {
    appendRequest: appendRequest("executionReport", { summary: "执行完成" }),
    error: null,
  };
  const reviewRun = {
    appendRequest: appendRequest("reviewReport", { verdict: "pass" }),
    error: null,
  };
  const convergenceRun = {
    appendRequest: appendRequest("convergenceSuccess", { summary: "已收敛" }),
    error: null,
  };

  const result = await runHumanConvergenceCorrectionRound({
    recommendationRun,
    repositoryDir: process.cwd(),
    applyAppendRequest,
    runCorrectionRound: async ({ applyAppendRequest: appendDuringRound }) => {
      await appendDuringRound(executionRun.appendRequest, { currentWorkStage: "execution-agent" });
      await appendDuringRound(reviewRun.appendRequest, { currentWorkStage: "review-agent" });
      await appendDuringRound(convergenceRun.appendRequest, { currentWorkStage: "convergence" });
      return {
        executionAgentRun: executionRun,
        reviewAgentRun: reviewRun,
        convergenceRun,
      };
    },
  });

  assert.deepEqual(result, {
    execution: executionRun,
    review: reviewRun,
    convergence: convergenceRun,
  });
  assert.deepEqual(
    calls.map((call) => [call.appendRequest.artifactType, call.currentWorkStage]),
    [
      ["executionReport", "execution-agent"],
      ["reviewReport", "review-agent"],
      ["convergenceSuccess", "convergence"],
      ["humanDecisionRequest", "human-decision"],
    ],
  );
  assert.deepEqual(recommendationRun.executionAgentRuns, [executionRun]);
  assert.deepEqual(recommendationRun.reviewAgentRuns, [reviewRun]);
  assert.deepEqual(recommendationRun.convergenceRuns, [convergenceRun]);
  assert.deepEqual(recommendationRun.executionAgentErrors, []);
  assert.equal(
    recommendationRun.successHumanDecisionRequest.appendRequest.artifact.convergenceSuccessRef,
    "convergenceSuccess",
  );
  assert.equal(recommendationRun.successHumanDecisionError, null);
});

test("human convergence correction round stops projection after execution failure", async () => {
  const recommendationRun = createRecommendationRun();
  const { applyAppendRequest, calls } = createAppendRecorder(recommendationRun);
  const executionRun = {
    appendRequest: null,
    error: "execution failed",
  };

  const result = await runHumanConvergenceCorrectionRound({
    recommendationRun,
    repositoryDir: process.cwd(),
    applyAppendRequest,
    runCorrectionRound: async () => ({
      executionAgentRun: executionRun,
      reviewAgentRun: {
        appendRequest: appendRequest("reviewReport", { verdict: "pass" }),
        error: null,
      },
      convergenceRun: {
        appendRequest: appendRequest("convergenceSuccess", { summary: "已收敛" }),
        error: null,
      },
    }),
  });

  assert.deepEqual(result, {
    execution: executionRun,
    review: null,
    convergence: null,
  });
  assert.deepEqual(calls, []);
  assert.deepEqual(recommendationRun.executionAgentRuns, [executionRun]);
  assert.deepEqual(recommendationRun.executionAgentErrors, ["execution failed"]);
  assert.deepEqual(recommendationRun.reviewAgentRuns, []);
  assert.deepEqual(recommendationRun.convergenceRuns, []);
  assert.equal(recommendationRun.successHumanDecisionRequest, undefined);
});
