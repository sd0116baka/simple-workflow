import { test } from "node:test";
import assert from "node:assert/strict";
import { projectRecommendationPreparationFields } from "../src/workflow/recommendation-run-preparation-projection.js";

test("preparation projection exposes intent, admission, workspace, and main agent fields", () => {
  const fields = projectRecommendationPreparationFields({
    parsed: {
      intent: {
        confidence: "high",
      },
      appendRequest: {
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
  });

  assert.equal(fields.executionIntent.confidence, "high");
  assert.equal(fields.executionIntentAppendRequest.artifactType, "executionIntent");
  assert.equal(fields.executionIntentError, null);
  assert.equal(fields.executionAdmission.appendRequest.artifactType, "executionAuthorization");
  assert.equal(fields.isolatedWorkspaceAllocation.appendRequest.artifactType, "isolatedWorkspace");
  assert.equal(fields.isolatedWorkspaceError, null);
  assert.equal(fields.mainAgentInitialization.appendRequest.artifactType, "mainAgentInitialization");
  assert.equal(fields.mainAgentInitializationError, null);
});

test("preparation projection preserves parse and setup errors", () => {
  const fields = projectRecommendationPreparationFields({
    parsed: {
      intent: null,
      appendRequest: null,
      error: "invalid recommendation intent",
    },
    executionAdmission: null,
    isolatedWorkspaceAllocation: {
      error: "workspace skipped",
    },
    mainAgentInitialization: {
      error: "main skipped",
    },
  });

  assert.equal(fields.executionIntent, null);
  assert.equal(fields.executionIntentAppendRequest, null);
  assert.equal(fields.executionIntentError, "invalid recommendation intent");
  assert.equal(fields.executionAdmission, null);
  assert.equal(fields.isolatedWorkspaceError, "workspace skipped");
  assert.equal(fields.mainAgentInitializationError, "main skipped");
});
