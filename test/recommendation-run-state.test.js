import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensureManualWorkflowActionRun,
  requestRecommendationRunCancellation,
} from "../src/workflow/recommendation-run-state.js";

test("manual workflow action run preserves completed run state and attaches package", () => {
  const existingRun = {
    id: "recommendation-run-1",
    status: "succeeded",
    args: [],
    progress: [],
  };
  const taskContextPackage = { packageId: "task-context-package:tasks/task-001.yaml" };

  const run = ensureManualWorkflowActionRun(existingRun, { taskContextPackage });

  assert.equal(run, existingRun);
  assert.equal(run.taskContextPackage, taskContextPackage);
  assert.deepEqual(run.executionAgentRuns, []);
  assert.deepEqual(run.reviewAgentRuns, []);
  assert.deepEqual(run.convergenceRuns, []);
});

test("manual workflow action run replaces a running recommendation run", () => {
  const taskContextPackage = { packageId: "task-context-package:tasks/task-001.yaml" };
  const run = ensureManualWorkflowActionRun(
    { id: "recommendation-run-1", status: "running", args: [], progress: [] },
    {
      taskContextPackage,
      now: () => "2026-05-21T00:00:00.000Z",
    },
  );

  assert.equal(run.id, "manual-workflow-action");
  assert.equal(run.status, "succeeded");
  assert.equal(run.startedAt, "2026-05-21T00:00:00.000Z");
  assert.equal(run.taskContextPackage, taskContextPackage);
  assert.equal(run.autoMergePlanning, null);
  assert.equal(run.taskCloseout, null);
});

test("recommendation run cancellation updates running run state", () => {
  const run = {
    id: "recommendation-run-1",
    status: "running",
    progress: [],
  };

  const result = requestRecommendationRunCancellation(run, {
    now: () => "2026-05-21T00:00:00.000Z",
  });

  assert.equal(result.cancelled, true);
  assert.equal(run.status, "cancelled");
  assert.equal(run.error, "cancelled");
  assert.equal(run.progress[0].type, "cancel_requested");
  assert.equal(run.progress[0].timestamp, "2026-05-21T00:00:00.000Z");
});

test("recommendation run cancellation rejects when no run is running", () => {
  const result = requestRecommendationRunCancellation(null);

  assert.equal(result.cancelled, false);
  assert.equal(result.error, "没有正在运行的推荐器流程。");
  assert.equal(result.run, null);
});
