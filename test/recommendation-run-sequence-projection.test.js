import { test } from "node:test";
import assert from "node:assert/strict";
import { createSkippedRecommendationSequence } from "../src/workflow/recommendation-completion-sequence-shape.js";
import { projectRecommendationSequenceFields } from "../src/workflow/recommendation-run-sequence-projection.js";

test("sequence projection exposes agent runs, human decision requests, task package, and errors", () => {
  const sequence = {
    executionAgentRuns: [
      { runId: "execution-agent:001", error: null },
      { runId: "execution-agent:002", error: "execution failed" },
    ],
    reviewAgentRuns: [
      { runId: "review-agent:001", error: "review failed" },
    ],
    convergenceRuns: [
      { runId: "convergence:001", error: null },
    ],
    successHumanDecisionRequest: {
      appendRequest: { artifactType: "humanDecisionRequest" },
      error: "success request failed",
    },
    failureHumanDecisionRequest: {
      appendRequest: { artifactType: "humanDecisionRequest" },
      error: null,
    },
    taskContextPackage: {
      packageId: "task-context-package:tasks/task-001.yaml",
    },
  };

  const fields = projectRecommendationSequenceFields(sequence);

  assert.equal(fields.executionAgentRuns, sequence.executionAgentRuns);
  assert.deepEqual(fields.executionAgentErrors, ["execution failed"]);
  assert.equal(fields.reviewAgentRuns, sequence.reviewAgentRuns);
  assert.deepEqual(fields.reviewAgentErrors, ["review failed"]);
  assert.equal(fields.convergenceRuns, sequence.convergenceRuns);
  assert.deepEqual(fields.convergenceErrors, []);
  assert.equal(fields.successHumanDecisionRequest, sequence.successHumanDecisionRequest);
  assert.equal(fields.successHumanDecisionError, "success request failed");
  assert.equal(fields.failureHumanDecisionRequest, sequence.failureHumanDecisionRequest);
  assert.equal(fields.failureHumanDecisionError, null);
  assert.equal(fields.taskContextPackage, sequence.taskContextPackage);
});

test("sequence projection preserves skipped sequence empty fields", () => {
  const sequence = createSkippedRecommendationSequence(null);
  const fields = projectRecommendationSequenceFields(sequence);

  assert.deepEqual(fields.executionAgentRuns, []);
  assert.deepEqual(fields.executionAgentErrors, []);
  assert.deepEqual(fields.reviewAgentRuns, []);
  assert.deepEqual(fields.reviewAgentErrors, []);
  assert.deepEqual(fields.convergenceRuns, []);
  assert.deepEqual(fields.convergenceErrors, []);
  assert.equal(fields.successHumanDecisionRequest, null);
  assert.equal(fields.successHumanDecisionError, null);
  assert.equal(fields.failureHumanDecisionRequest, null);
  assert.equal(fields.failureHumanDecisionError, null);
  assert.equal(fields.taskContextPackage, null);
});
