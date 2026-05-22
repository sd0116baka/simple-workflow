import { test } from "node:test";
import assert from "node:assert/strict";
import { createSkippedRecommendationSequence } from "../src/workflow/recommendation-completion-sequence-shape.js";
import { buildCompletedRecommendationRun } from "../src/workflow/recommendation-run-completion-projection.js";

function baseRun() {
  return {
    id: "recommendation-run:001",
    status: "running",
    startedAt: "2026-05-22T10:00:00.000Z",
    command: "opencode",
    args: ["run", "--format", "json"],
    progress: [],
  };
}

function successfulPreparation() {
  return {
    commandFailed: false,
    parsed: {
      intent: {
        confidence: "high",
      },
      appendRequest: {
        packageId: "task-context-package:tasks/task-001.yaml",
        artifactType: "executionIntent",
      },
      error: null,
    },
    executionAdmission: {
      appendRequest: {
        artifactType: "executionAuthorization",
      },
    },
    isolatedWorkspaceAllocation: {
      appendRequest: {
        artifactType: "isolatedWorkspace",
      },
    },
    mainAgentInitialization: {
      appendRequest: {
        artifactType: "mainAgentInitialization",
      },
    },
  };
}

test("completion projection builds terminal succeeded run snapshot", () => {
  const completed = buildCompletedRecommendationRun({
    run: baseRun(),
    commandResult: {
      stdout: "result stdout",
      stderr: "",
      exitCode: 0,
      error: null,
    },
    preparation: successfulPreparation(),
    sequence: {
      executionAgentRuns: [
        {
          appendRequest: {
            artifactType: "executionReport",
          },
          error: null,
        },
        {
          appendRequest: {
            artifactType: "executionReport",
          },
          error: "execution warning",
        },
      ],
      reviewAgentRuns: [
        {
          appendRequest: {
            artifactType: "reviewReport",
          },
          error: "review failed",
        },
      ],
      convergenceRuns: [
        {
          appendRequest: {
            artifactType: "convergenceAdvice",
          },
          error: null,
        },
      ],
      successHumanDecisionRequest: {
        appendRequest: {
          artifactType: "humanDecisionRequest",
        },
      },
      failureHumanDecisionRequest: null,
      taskContextPackage: {
        id: "task-context-package:tasks/task-001.yaml",
      },
    },
    now: () => "2026-05-22T10:01:00.000Z",
  });

  assert.equal(completed.status, "succeeded");
  assert.equal(completed.finishedAt, "2026-05-22T10:01:00.000Z");
  assert.equal(completed.stdout, "result stdout");
  assert.equal(completed.exitCode, 0);
  assert.equal(completed.executionIntent.confidence, "high");
  assert.equal(completed.executionIntentAppendRequest.artifactType, "executionIntent");
  assert.equal(completed.executionAdmission.appendRequest.artifactType, "executionAuthorization");
  assert.equal(completed.isolatedWorkspaceAllocation.appendRequest.artifactType, "isolatedWorkspace");
  assert.equal(completed.isolatedWorkspaceError, null);
  assert.equal(completed.mainAgentInitialization.appendRequest.artifactType, "mainAgentInitialization");
  assert.equal(completed.mainAgentInitializationError, null);
  assert.deepEqual(completed.executionAgentErrors, ["execution warning"]);
  assert.deepEqual(completed.reviewAgentErrors, ["review failed"]);
  assert.deepEqual(completed.convergenceErrors, []);
  assert.equal(completed.successHumanDecisionRequest.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(completed.successHumanDecisionError, null);
  assert.equal(completed.failureHumanDecisionRequest, null);
  assert.equal(completed.failureHumanDecisionError, null);
  assert.equal(completed.taskContextPackage.id, "task-context-package:tasks/task-001.yaml");
});

test("completion projection builds terminal failed run snapshot from command failure", () => {
  const completed = buildCompletedRecommendationRun({
    run: baseRun(),
    commandResult: {
      stdout: "",
      stderr: "command stderr",
      exitCode: 1,
      error: "command failed",
    },
    preparation: {
      commandFailed: true,
      parsed: {
        intent: null,
        appendRequest: null,
        error: null,
      },
      executionAdmission: null,
      isolatedWorkspaceAllocation: {
        error: "workspace skipped",
      },
      mainAgentInitialization: {
        error: "main skipped",
      },
    },
    sequence: createSkippedRecommendationSequence(null),
    now: () => "2026-05-22T10:02:00.000Z",
  });

  assert.equal(completed.status, "failed");
  assert.equal(completed.finishedAt, "2026-05-22T10:02:00.000Z");
  assert.equal(completed.stdout, "");
  assert.equal(completed.stderr, "command stderr");
  assert.equal(completed.exitCode, 1);
  assert.equal(completed.error, "command failed");
  assert.equal(completed.executionIntent, null);
  assert.equal(completed.executionIntentAppendRequest, null);
  assert.equal(completed.executionIntentError, null);
  assert.equal(completed.executionAdmission, null);
  assert.equal(completed.isolatedWorkspaceError, "workspace skipped");
  assert.equal(completed.mainAgentInitializationError, "main skipped");
  assert.deepEqual(completed.executionAgentRuns, []);
  assert.deepEqual(completed.reviewAgentRuns, []);
  assert.deepEqual(completed.convergenceRuns, []);
  assert.equal(completed.taskContextPackage, null);
});
