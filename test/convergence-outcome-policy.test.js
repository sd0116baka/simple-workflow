import { test } from "node:test";
import assert from "node:assert/strict";
import { convergenceOutcome } from "../src/workflow/convergence-outcome-policy.js";

function record(artifactId, body = {}) {
  return { artifactId, body, appendedAt: "2026-05-21T10:00:00.000Z" };
}

test("convergence outcome requests advice for a first reviewed execution", () => {
  assert.deepEqual(convergenceOutcome({
    taskContextPackage: { artifacts: {} },
    reviewReport: record("reviewReport:001", { outcome: "passed" }),
  }), {
    kind: "advice",
  });
});

test("convergence outcome succeeds after a passing review used prior advice", () => {
  assert.deepEqual(convergenceOutcome({
    taskContextPackage: {
      artifacts: {
        convergenceAdvice: [record("convergenceAdvice:001")],
      },
    },
    reviewReport: record("reviewReport:002", { outcome: "passed" }),
    maxIterations: 1,
  }), {
    kind: "success",
  });
});

test("convergence outcome fails when the automatic iteration budget is exhausted", () => {
  assert.deepEqual(convergenceOutcome({
    taskContextPackage: {
      artifacts: {
        convergenceAdvice: [
          record("convergenceAdvice:001"),
          record("convergenceAdvice:002"),
        ],
      },
    },
    reviewReport: record("reviewReport:003", { outcome: "failed" }),
    maxIterations: 2,
  }), {
    kind: "failure",
    failureInput: {
      attemptedFixRefs: [
        "convergenceAdvice:001",
        "convergenceAdvice:002",
      ],
      completedIterations: 2,
      maxIterations: 2,
    },
  });
});

test("convergence outcome preserves zero-budget failure semantics", () => {
  assert.deepEqual(convergenceOutcome({
    taskContextPackage: { artifacts: {} },
    reviewReport: record("reviewReport:001", { outcome: "failed" }),
    maxIterations: 0,
  }), {
    kind: "failure",
    failureInput: {
      attemptedFixRefs: [],
      completedIterations: 1,
      maxIterations: 0,
    },
  });
});
