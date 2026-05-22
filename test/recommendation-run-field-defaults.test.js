import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyRecommendationRunFields,
  RECOMMENDATION_RUN_FIELD_CLONE_GROUPS,
} from "../src/workflow/recommendation-run-field-defaults.js";

test("recommendation run field defaults cover downstream workflow states", () => {
  const fields = createEmptyRecommendationRunFields();

  assert.deepEqual(fields.progress, []);
  assert.equal(fields.executionIntent, null);
  assert.equal(fields.humanConvergenceGuidance, null);
  assert.equal(fields.taskCancellation, null);
  assert.equal(fields.autoMergePlanning, null);
  assert.equal(fields.autoMergeExecution, null);
  assert.equal(fields.autoMergeHumanDecisionRequest, null);
  assert.equal(fields.taskCloseout, null);
  assert.equal(fields.stdout, "");
  assert.equal(fields.exitCode, null);
});

test("recommendation run field defaults return fresh mutable collections", () => {
  const first = createEmptyRecommendationRunFields();
  const second = createEmptyRecommendationRunFields();

  first.progress.push({ message: "first" });
  first.executionAgentRuns.push({ runId: "execution-agent:001" });

  assert.deepEqual(second.progress, []);
  assert.deepEqual(second.executionAgentRuns, []);
});

test("recommendation run field clone groups classify default fields", () => {
  const defaults = createEmptyRecommendationRunFields();
  const classified = new Set([
    "progress",
    ...RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.jsonOrNull,
    ...RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.jsonArray,
    ...RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.stringArray,
    ...Object.keys(RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.scalarDefaults),
  ]);

  assert.equal(classified.size, Object.keys(defaults).length);
  for (const fieldName of Object.keys(defaults)) {
    assert.equal(classified.has(fieldName), true, fieldName);
  }
  assert.equal(
    RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.jsonOrNull.includes("taskContextPackage"),
    true,
  );
  assert.equal(
    Object.hasOwn(RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.scalarDefaults, "exitCode"),
    true,
  );
});
