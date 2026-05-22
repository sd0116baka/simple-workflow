import { test } from "node:test";
import assert from "node:assert/strict";
import { continueConvergenceWithHumanGuidance } from "../src/workflow/human-convergence-action.js";

function guidablePackage() {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "human-decision",
    taskDraft: { id: "task-001", name: "测试任务" },
    artifacts: {
      convergenceFailure: [
        {
          artifactId: "convergenceFailure:001",
          body: { reasonCode: "max-iterations-reached" },
        },
      ],
      humanDecisionRequest: {
        artifactId: "humanDecisionRequest",
        body: {
          targetRef: "convergenceFailure:001",
          decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
        },
      },
    },
    agentRuns: [],
    timeline: [],
  };
}

function createRecommendationRun(taskContextPackage = guidablePackage()) {
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

function createAppendRecorder(recommendationRun) {
  const calls = [];
  return {
    calls,
    applyAppendRequest: async (appendRequest, { currentWorkStage }) => {
      calls.push({ appendRequest, currentWorkStage });
      const record = {
        artifactId: appendRequest.artifactType,
        body: appendRequest.artifact,
        appendedAt: appendRequest.artifact.appendedAt ?? "2026-05-21T00:00:00.000Z",
      };
      recommendationRun.taskContextPackage = {
        ...recommendationRun.taskContextPackage,
        currentWorkStage,
        artifacts: {
          ...recommendationRun.taskContextPackage.artifacts,
          [appendRequest.artifactType]: record,
        },
      };
    },
  };
}

test("human convergence action rejects empty guidance before running agents", async () => {
  const recommendationRun = createRecommendationRun();
  const { applyAppendRequest, calls } = createAppendRecorder(recommendationRun);

  const result = await continueConvergenceWithHumanGuidance({
    taskContextPackage: recommendationRun.taskContextPackage,
    recommendationRun,
    guidance: " ",
    repositoryDir: process.cwd(),
    applyAppendRequest,
  });

  assert.equal(result.shouldEmit, true);
  assert.equal(result.response.continued, false);
  assert.match(result.response.error, /不能为空/);
  assert.equal(recommendationRun.humanConvergenceGuidanceError, result.response.error);
  assert.deepEqual(calls, []);
});

test("human convergence action runs guided correction and requests human decision after success", async () => {
  const recommendationRun = createRecommendationRun();
  const { applyAppendRequest, calls } = createAppendRecorder(recommendationRun);
  const observedAgentSessions = [];
  const runReviewAgentSession = async () => ({ sessionId: "session:review", status: "succeeded" });
  const runConvergenceSession = async () => ({ sessionId: "session:convergence", status: "succeeded" });

  const result = await continueConvergenceWithHumanGuidance({
    taskContextPackage: recommendationRun.taskContextPackage,
    recommendationRun,
    guidance: "请聚焦验收标准",
    repositoryDir: process.cwd(),
    applyAppendRequest,
    runExecution: async () => ({
      appendRequest: {
        packageId: recommendationRun.taskContextPackage.packageId,
        artifactType: "executionReport",
        artifact: { summary: "执行完成" },
      },
      error: null,
    }),
    runReviewAgentSession,
    runConvergenceSession,
    runReview: ({ runAgentSession }) => {
      observedAgentSessions.push(["review", runAgentSession]);
      return {
        appendRequest: {
          packageId: recommendationRun.taskContextPackage.packageId,
          artifactType: "reviewReport",
          artifact: { verdict: "pass" },
        },
        error: null,
      };
    },
    runConverge: ({ runAgentSession }) => {
      observedAgentSessions.push(["convergence", runAgentSession]);
      return {
        appendRequest: {
          packageId: recommendationRun.taskContextPackage.packageId,
          artifactType: "convergenceSuccess",
          artifact: { summary: "已收敛" },
        },
        error: null,
      };
    },
  });

  assert.equal(result.shouldEmit, true);
  assert.deepEqual(result.response, { continued: true, error: null });
  assert.deepEqual(
    calls.map((call) => [call.appendRequest.artifactType, call.currentWorkStage]),
    [
      ["humanConvergenceGuidance", "execution-agent"],
      ["executionReport", "execution-agent"],
      ["reviewReport", "review-agent"],
      ["convergenceSuccess", "convergence"],
      ["humanDecisionRequest", "human-decision"],
    ],
  );
  assert.equal(recommendationRun.humanConvergenceGuidanceError, null);
  assert.equal(recommendationRun.executionAgentRuns.length, 1);
  assert.equal(recommendationRun.reviewAgentRuns.length, 1);
  assert.equal(recommendationRun.convergenceRuns.length, 1);
  assert.deepEqual(observedAgentSessions, [
    ["review", runReviewAgentSession],
    ["convergence", runConvergenceSession],
  ]);
  assert.equal(
    recommendationRun.successHumanDecisionRequest.appendRequest.artifact.convergenceSuccessRef,
    "convergenceSuccess",
  );
});
