import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCancelledTaskCloseoutTransition,
  applyTaskCloseoutOutcome,
  previewPackageAfterCloseoutDecision,
  taskCloseoutOutcomeStage,
} from "../src/workflow/task-closeout-transition.js";

function appendRequest(artifactType, artifact = {}) {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType,
    artifact,
  };
}

function taskContextPackage() {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "human-decision",
    recognition: { outcome: "recognized" },
    qualityGate: { outcome: "pass" },
    artifacts: {},
    agentRuns: [],
    timeline: [],
  };
}

function createAppendRecorder() {
  const calls = [];
  return {
    calls,
    applyAppendRequest: async (request, { currentWorkStage }) => {
      calls.push({ appendRequest: request, currentWorkStage });
    },
  };
}

test("task closeout outcome stage uses the artifact final stage", () => {
  assert.equal(
    taskCloseoutOutcomeStage({ appendRequest: appendRequest("taskCloseout", { finalStage: "cancelled" }) }),
    "cancelled",
  );
  assert.equal(taskCloseoutOutcomeStage({ appendRequest: appendRequest("taskCloseout") }), "closed");
});

test("task closeout outcome appends closeout and records recommendation run state", async () => {
  const recommendationRun = {};
  const { calls, applyAppendRequest } = createAppendRecorder();
  const closeout = {
    appendRequest: appendRequest("taskCloseout", { finalStage: "closed" }),
    error: null,
  };

  const result = await applyTaskCloseoutOutcome({
    recommendationRun,
    closeout,
    applyAppendRequest,
  });

  assert.deepEqual(result, { closed: true, currentWorkStage: "closed" });
  assert.deepEqual(
    calls.map((call) => [call.appendRequest.artifactType, call.currentWorkStage]),
    [["taskCloseout", "closed"]],
  );
  assert.equal(recommendationRun.taskCloseout, closeout);
  assert.equal(recommendationRun.taskCloseoutError, null);
});

test("cancelled closeout transition previews cancellation before persistent appends", async () => {
  const recommendationRun = {};
  const { calls, applyAppendRequest } = createAppendRecorder();
  const cancellation = {
    appendRequest: appendRequest("humanDecision", { decision: "cancel-task" }),
    error: null,
  };
  let closeCancelledPackage = null;

  const result = await applyCancelledTaskCloseoutTransition({
    taskContextPackage: taskContextPackage(),
    recommendationRun,
    cancellation,
    repositoryDir: process.cwd(),
    applyAppendRequest,
    closeCancelled: ({ taskContextPackage: previewedPackage }) => {
      closeCancelledPackage = previewedPackage;
      return {
        appendRequest: appendRequest("taskCloseout", { finalStage: "cancelled" }),
        error: null,
      };
    },
  });

  assert.equal(result.cancelled, true);
  assert.equal(closeCancelledPackage.currentWorkStage, "task-closeout");
  assert.equal(closeCancelledPackage.artifacts.humanDecision.body.decision, "cancel-task");
  assert.deepEqual(
    calls.map((call) => [call.appendRequest.artifactType, call.currentWorkStage]),
    [
      ["humanDecision", "task-closeout"],
      ["taskCloseout", "cancelled"],
    ],
  );
  assert.equal(recommendationRun.taskCancellation, cancellation);
  assert.equal(recommendationRun.taskCancellationError, null);
  assert.equal(recommendationRun.taskCloseout.appendRequest.artifactType, "taskCloseout");
  assert.equal(recommendationRun.taskCloseoutError, null);
});

test("cancelled closeout transition does not persist cancellation when closeout fails", async () => {
  const recommendationRun = {};
  const { calls, applyAppendRequest } = createAppendRecorder();

  const result = await applyCancelledTaskCloseoutTransition({
    taskContextPackage: taskContextPackage(),
    recommendationRun,
    cancellation: {
      appendRequest: appendRequest("humanDecision", { decision: "cancel-task" }),
      error: null,
    },
    repositoryDir: process.cwd(),
    applyAppendRequest,
    closeCancelled: () => ({
      appendRequest: null,
      error: "closeout failed",
    }),
  });

  assert.deepEqual(result, {
    cancelled: false,
    closeout: {
      appendRequest: null,
      error: "closeout failed",
    },
    error: "closeout failed",
  });
  assert.deepEqual(calls, []);
  assert.equal(recommendationRun.taskCloseoutError, "closeout failed");
  assert.equal(recommendationRun.taskCancellation, undefined);
});

test("closeout decision preview uses task-closeout stage", () => {
  const previewed = previewPackageAfterCloseoutDecision({
    taskContextPackage: taskContextPackage(),
    decisionAppendRequest: appendRequest("humanDecision", { decision: "cancel-task" }),
  });

  assert.equal(previewed.currentWorkStage, "task-closeout");
  assert.equal(previewed.artifacts.humanDecision.body.decision, "cancel-task");
});
