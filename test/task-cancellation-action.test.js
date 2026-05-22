import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelTaskFromHumanDecision } from "../src/workflow/task-cancellation-action.js";

function cancellablePackage() {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "human-decision",
    recognition: { outcome: "recognized" },
    qualityGate: { outcome: "pass" },
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

function createAppendRecorder() {
  const calls = [];
  return {
    calls,
    applyAppendRequest: async (appendRequest, { currentWorkStage }) => {
      calls.push({ appendRequest, currentWorkStage });
    },
  };
}

test("task cancellation action rejects packages outside human decision", async () => {
  const recommendationRun = {};
  const { applyAppendRequest, calls } = createAppendRecorder();

  const result = await cancelTaskFromHumanDecision({
    taskContextPackage: {
      ...cancellablePackage(),
      currentWorkStage: "execution-agent",
    },
    recommendationRun,
    repositoryDir: process.cwd(),
    applyAppendRequest,
  });

  assert.equal(result.shouldEmit, true);
  assert.equal(result.response.cancelled, false);
  assert.match(result.response.error, /human-decision/);
  assert.equal(recommendationRun.taskCancellationError, result.response.error);
  assert.deepEqual(calls, []);
});

test("task cancellation action records cancellation and closeout append requests", async () => {
  const recommendationRun = {};
  const { applyAppendRequest, calls } = createAppendRecorder();

  const result = await cancelTaskFromHumanDecision({
    taskContextPackage: cancellablePackage(),
    recommendationRun,
    repositoryDir: process.cwd(),
    applyAppendRequest,
    closeCancelled: ({ taskContextPackage }) => {
      assert.equal(taskContextPackage.currentWorkStage, "task-closeout");
      assert.equal(taskContextPackage.artifacts.humanDecision.body.decision, "cancel-task");
      return {
        appendRequest: {
          packageId: taskContextPackage.packageId,
          artifactType: "taskCloseout",
          artifact: { status: "cancelled" },
        },
        error: null,
      };
    },
  });

  assert.equal(result.shouldEmit, true);
  assert.deepEqual(result.response, { cancelled: true, error: null });
  assert.deepEqual(
    calls.map((call) => [call.appendRequest.artifactType, call.currentWorkStage]),
    [
      ["humanDecision", "task-closeout"],
      ["taskCloseout", "cancelled"],
    ],
  );
  assert.equal(recommendationRun.taskCancellation.appendRequest.artifactType, "humanDecision");
  assert.equal(recommendationRun.taskCancellationError, null);
  assert.equal(recommendationRun.taskCloseout.appendRequest.artifactType, "taskCloseout");
  assert.equal(recommendationRun.taskCloseoutError, null);
});
