import { test } from "node:test";
import assert from "node:assert/strict";
import { runRecommendationCompletionSequence } from "../src/workflow/recommendation-completion-sequence.js";

function successfulPreparation() {
  return {
    commandFailed: false,
    taskPool: {
      views: {
        candidateTasks: [],
      },
    },
    packageId: "task-context-package:tasks/task-001.yaml",
    mainAgentInitialization: {
      appendRequest: {
        artifactType: "mainAgentInitialization",
      },
    },
    parsed: {
      appendRequest: {
        packageId: "task-context-package:tasks/task-001.yaml",
        artifactType: "executionIntent",
      },
    },
  };
}

test("recommendation completion sequence skips downstream agents after command failure", async () => {
  const taskPool = {
    entries: [],
  };

  const sequence = await runRecommendationCompletionSequence({
    preparation: {
      commandFailed: true,
      taskPool,
      parsed: {
        appendRequest: {
          artifactType: "executionIntent",
        },
      },
    },
    runRecommendationAgentSequence() {
      throw new Error("failed commands should not run agent sequence");
    },
  });

  assert.equal(sequence.taskPool, taskPool);
  assert.equal(sequence.taskContextPackage, null);
  assert.deepEqual(sequence.executionAgentRuns, []);
  assert.deepEqual(sequence.reviewAgentRuns, []);
  assert.deepEqual(sequence.convergenceRuns, []);
  assert.equal(sequence.successHumanDecisionRequest, null);
  assert.equal(sequence.failureHumanDecisionRequest, null);
});

test("recommendation completion sequence skips downstream agents when intent parsing produced no append request", async () => {
  const taskPool = {
    entries: [],
  };

  const sequence = await runRecommendationCompletionSequence({
    preparation: {
      commandFailed: false,
      taskPool,
      parsed: {
        appendRequest: null,
      },
    },
    runRecommendationAgentSequence() {
      throw new Error("missing append request should not run agent sequence");
    },
  });

  assert.equal(sequence.taskPool, taskPool);
  assert.deepEqual(sequence.executionAgentRuns, []);
  assert.deepEqual(sequence.reviewAgentRuns, []);
  assert.deepEqual(sequence.convergenceRuns, []);
});

test("recommendation completion sequence runs agent sequence with project iteration limit", async () => {
  const preparation = successfulPreparation();
  const executionSession = () => {};
  const reviewSession = () => {};
  const convergenceSession = () => {};
  const now = () => "2026-05-22T00:00:00.000Z";
  const onProgress = () => {};
  const signal = { aborted: false };
  let capturedInput;

  const sequence = await runRecommendationCompletionSequence({
    preparation,
    projectProfile: {
      defaults: {
        maxIterations: 5,
      },
    },
    runExecutionAgentSession: executionSession,
    runReviewAgentSession: reviewSession,
    runConvergenceSession: convergenceSession,
    repositoryDir: "repo-dir",
    now,
    onProgress,
    signal,
    runRecommendationAgentSequence(input) {
      capturedInput = input;
      return {
        taskPool: input.taskPool,
        taskContextPackage: { packageId: input.packageId },
        executionAgentRuns: [{ runId: "execution-agent:001" }],
        reviewAgentRuns: [],
        convergenceRuns: [],
        successHumanDecisionRequest: null,
        failureHumanDecisionRequest: null,
      };
    },
  });

  assert.equal(capturedInput.taskPool, preparation.taskPool);
  assert.equal(capturedInput.packageId, preparation.packageId);
  assert.equal(capturedInput.mainAgentInitialization, preparation.mainAgentInitialization);
  assert.equal(capturedInput.runExecutionAgentSession, executionSession);
  assert.equal(capturedInput.runReviewAgentSession, reviewSession);
  assert.equal(capturedInput.runConvergenceSession, convergenceSession);
  assert.equal(capturedInput.repositoryDir, "repo-dir");
  assert.equal(capturedInput.maxIterations, 5);
  assert.equal(capturedInput.now, now);
  assert.equal(capturedInput.onProgress, onProgress);
  assert.equal(capturedInput.signal, signal);
  assert.deepEqual(sequence.executionAgentRuns, [{ runId: "execution-agent:001" }]);
});

test("recommendation completion sequence passes null iteration limit by default", async () => {
  let capturedInput;

  await runRecommendationCompletionSequence({
    preparation: successfulPreparation(),
    runRecommendationAgentSequence(input) {
      capturedInput = input;
      return {
        taskPool: input.taskPool,
        taskContextPackage: null,
        executionAgentRuns: [],
        reviewAgentRuns: [],
        convergenceRuns: [],
        successHumanDecisionRequest: null,
        failureHumanDecisionRequest: null,
      };
    },
  });

  assert.equal(capturedInput.maxIterations, null);
});
