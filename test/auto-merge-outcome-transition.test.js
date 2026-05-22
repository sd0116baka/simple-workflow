import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAutoMergeExecutionOutcome,
  applyAutoMergePlanningOutcome,
  autoMergeExecutionOutcomeStage,
  autoMergePlanningOutcomeStage,
} from "../src/workflow/auto-merge-outcome-transition.js";

function appendRequest(artifactType, artifact = {}) {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType,
    artifact,
  };
}

function createRecommendationRun() {
  return {
    taskContextPackage: {
      packageId: "task-context-package:tasks/task-001.yaml",
      currentWorkStage: "auto-merge-planning",
      artifacts: {},
    },
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
          },
        },
      };
    },
  };
}

function requestHumanDecisionForIssue({ artifactType }) {
  return {
    appendRequest: appendRequest("humanDecisionRequest", {
      targetType: artifactType,
      targetRef: artifactType,
    }),
    error: null,
  };
}

test("auto merge outcome stages map planning and execution artifacts", () => {
  assert.equal(autoMergePlanningOutcomeStage(appendRequest("autoMergePlan")), "auto-merge-execution");
  assert.equal(autoMergePlanningOutcomeStage(appendRequest("autoMergeRejection")), "auto-merge-planning");
  assert.equal(autoMergeExecutionOutcomeStage(appendRequest("autoMergeResult")), "merged");
  assert.equal(autoMergeExecutionOutcomeStage(appendRequest("autoMergeFailure")), "auto-merge-execution");
});

test("planning outcome appends a plan and skips human decision", async () => {
  const recommendationRun = createRecommendationRun();
  const { calls, applyAppendRequest } = createAppendRecorder(recommendationRun);

  const result = await applyAutoMergePlanningOutcome({
    recommendationRun,
    planning: { appendRequest: appendRequest("autoMergePlan") },
    applyAppendRequest,
    requestHumanDecisionForIssue,
  });

  assert.deepEqual(result, { planned: true, humanDecisionRequest: null });
  assert.deepEqual(
    calls.map((call) => [call.appendRequest.artifactType, call.currentWorkStage]),
    [["autoMergePlan", "auto-merge-execution"]],
  );
  assert.equal(recommendationRun.autoMergePlanning.appendRequest.artifactType, "autoMergePlan");
  assert.equal(recommendationRun.autoMergePlanningError, null);
});

test("planning rejection requests human decision after recording rejection", async () => {
  const recommendationRun = createRecommendationRun();
  const { calls, applyAppendRequest } = createAppendRecorder(recommendationRun);

  const result = await applyAutoMergePlanningOutcome({
    recommendationRun,
    planning: { appendRequest: appendRequest("autoMergeRejection") },
    applyAppendRequest,
    requestHumanDecisionForIssue,
  });

  assert.equal(result.planned, false);
  assert.equal(result.humanDecisionRequest.appendRequest.artifact.targetType, "autoMergeRejection");
  assert.deepEqual(
    calls.map((call) => [call.appendRequest.artifactType, call.currentWorkStage]),
    [
      ["autoMergeRejection", "auto-merge-planning"],
      ["humanDecisionRequest", "human-decision"],
    ],
  );
  assert.equal(recommendationRun.autoMergeHumanDecisionRequest, result.humanDecisionRequest);
  assert.equal(recommendationRun.autoMergeHumanDecisionError, null);
});

test("execution failure requests human decision after recording failure", async () => {
  const recommendationRun = createRecommendationRun();
  recommendationRun.taskContextPackage.currentWorkStage = "auto-merge-execution";
  const { calls, applyAppendRequest } = createAppendRecorder(recommendationRun);

  const result = await applyAutoMergeExecutionOutcome({
    recommendationRun,
    execution: { appendRequest: appendRequest("autoMergeFailure") },
    applyAppendRequest,
    requestHumanDecisionForIssue,
  });

  assert.equal(result.executed, false);
  assert.equal(result.humanDecisionRequest.appendRequest.artifact.targetType, "autoMergeFailure");
  assert.deepEqual(
    calls.map((call) => [call.appendRequest.artifactType, call.currentWorkStage]),
    [
      ["autoMergeFailure", "auto-merge-execution"],
      ["humanDecisionRequest", "human-decision"],
    ],
  );
  assert.equal(recommendationRun.autoMergeExecution.appendRequest.artifactType, "autoMergeFailure");
  assert.equal(recommendationRun.autoMergeExecutionError, null);
});
