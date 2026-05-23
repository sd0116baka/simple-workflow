import { test } from "node:test";
import assert from "node:assert/strict";
import { canContinueRecommendationRunDownstream } from "../src/workflow/recommendation-run-downstream-continuation.js";

function runFixture(overrides = {}) {
  return {
    status: "succeeded",
    exitCode: 0,
    error: null,
    executionIntentAppendRequest: {
      packageId: "task-context-package:tasks/task-001.yaml",
    },
    stageSwitches: {
      executionAdmission: true,
      isolatedWorkspace: true,
      mainAgent: true,
      executionAgent: true,
      reviewAgent: true,
      convergence: true,
    },
    ...overrides,
  };
}

test("recommendation run downstream continuation allows probe output to enter admission", () => {
  assert.equal(canContinueRecommendationRunDownstream(runFixture()), true);
});

test("recommendation run downstream continuation respects the next closed stage switch", () => {
  assert.equal(canContinueRecommendationRunDownstream(runFixture({
    stageSwitches: {
      executionAdmission: false,
      isolatedWorkspace: true,
      mainAgent: true,
      executionAgent: true,
      reviewAgent: true,
      convergence: true,
    },
  })), false);
});

test("recommendation run downstream continuation continues from initialized main agent to execution", () => {
  assert.equal(canContinueRecommendationRunDownstream(runFixture({
    taskContextPackage: {
      artifacts: {
        executionAuthorization: { body: {} },
        isolatedWorkspace: { body: {} },
      },
      agentRuns: [
        {
          runId: "main-agent:initialization",
          status: "succeeded",
        },
      ],
    },
  })), true);
});

test("recommendation run downstream continuation stops after failed execution agent output", () => {
  assert.equal(canContinueRecommendationRunDownstream(runFixture({
    taskContextPackage: {
      artifacts: {
        executionAuthorization: { body: {} },
        isolatedWorkspace: { body: {} },
        executionReport: [
          {
            artifactId: "executionReport:001",
            body: {
              status: "failed",
            },
          },
        ],
      },
      agentRuns: [
        {
          runId: "main-agent:initialization",
          status: "succeeded",
        },
        {
          runId: "execution-agent:001",
          status: "failed",
          outputArtifactRefs: ["executionReport:001"],
        },
      ],
    },
  })), false);
});

test("recommendation run downstream continuation stops after terminal requests", () => {
  assert.equal(canContinueRecommendationRunDownstream(runFixture({
    successHumanDecisionRequest: {
      appendRequest: {
        artifactType: "humanDecisionRequest",
      },
    },
  })), false);
});
