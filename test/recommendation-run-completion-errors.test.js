import { test } from "node:test";
import assert from "node:assert/strict";
import { collectRecommendationCompletionErrors } from "../src/workflow/recommendation-run-completion-errors.js";

test("completion error projection collects agent and human decision errors", () => {
  const errors = collectRecommendationCompletionErrors({
    executionAgentRuns: [
      { error: null },
      { error: "execution failed" },
      {},
    ],
    reviewAgentRuns: [
      { error: "review failed" },
      { error: "" },
    ],
    convergenceRuns: [
      { error: null },
      { error: "convergence failed" },
    ],
    successHumanDecisionRequest: {
      error: "success human decision failed",
    },
    failureHumanDecisionRequest: {
      error: "failure human decision failed",
    },
  });

  assert.deepEqual(errors, {
    executionAgentErrors: ["execution failed"],
    reviewAgentErrors: ["review failed"],
    convergenceErrors: ["convergence failed"],
    successHumanDecisionError: "success human decision failed",
    failureHumanDecisionError: "failure human decision failed",
  });
});

test("completion error projection returns empty collections and null human decision errors", () => {
  const errors = collectRecommendationCompletionErrors({
    executionAgentRuns: [],
    reviewAgentRuns: [],
    convergenceRuns: [],
    successHumanDecisionRequest: null,
    failureHumanDecisionRequest: null,
  });

  assert.deepEqual(errors, {
    executionAgentErrors: [],
    reviewAgentErrors: [],
    convergenceErrors: [],
    successHumanDecisionError: null,
    failureHumanDecisionError: null,
  });
});
