import { test } from "node:test";
import assert from "node:assert/strict";
import { createSkippedRecommendationSequence } from "../src/workflow/recommendation-completion-sequence-shape.js";

test("skipped recommendation sequence preserves task pool and empty downstream runs", () => {
  const taskPool = {
    views: {
      candidateTasks: [],
    },
  };
  const sequence = createSkippedRecommendationSequence(taskPool);

  assert.equal(sequence.taskPool, taskPool);
  assert.equal(sequence.taskContextPackage, null);
  assert.deepEqual(sequence.executionAgentRuns, []);
  assert.deepEqual(sequence.reviewAgentRuns, []);
  assert.deepEqual(sequence.convergenceRuns, []);
  assert.equal(sequence.successHumanDecisionRequest, null);
  assert.equal(sequence.failureHumanDecisionRequest, null);
});
