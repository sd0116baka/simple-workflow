import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCompletedRecommendationRun,
  applyFailedRecommendationRun,
} from "../src/workflow/recommendation-run-completion-outcome.js";

test("completed recommendation run outcome writes completed state and persists package", async () => {
  const persisted = [];
  const run = {
    id: "recommendation-run-1",
    status: "running",
    startedAt: "2026-05-22T00:00:00.000Z",
  };

  const outcome = await applyCompletedRecommendationRun({
    run,
    completedRun: {
      status: "succeeded",
      exitCode: 0,
      finishedAt: "2026-05-22T00:00:10.000Z",
      executionIntentAppendRequest: {
        packageId: "task-context-package:tasks/task-001.yaml",
      },
      taskContextPackage: { packageId: "completed-package" },
    },
    persistTaskContextPackage(taskContextPackage) {
      persisted.push(taskContextPackage);
    },
  });

  assert.deepEqual(outcome, { applied: true });
  assert.equal(run.status, "succeeded");
  assert.deepEqual(run.taskRecommender, {
    status: "succeeded",
    startedAt: "2026-05-22T00:00:00.000Z",
    finishedAt: "2026-05-22T00:00:10.000Z",
    selectedPackageId: "task-context-package:tasks/task-001.yaml",
    outputRef: "executionIntent",
    error: null,
  });
  assert.deepEqual(run.taskContextPackage, { packageId: "completed-package" });
  assert.deepEqual(persisted, [{ packageId: "completed-package" }]);
});

test("completed recommendation run outcome preserves completed recommender state during downstream completion", async () => {
  const persisted = [];
  const taskRecommender = {
    status: "succeeded",
    startedAt: "2026-05-22T00:00:00.000Z",
    finishedAt: "2026-05-22T00:00:10.000Z",
    selectedPackageId: "task-context-package:tasks/task-001.yaml",
    outputRef: "executionIntent",
    error: null,
  };
  const run = {
    id: "recommendation-run-1",
    status: "running",
    taskRecommender,
  };

  const outcome = await applyCompletedRecommendationRun({
    run,
    completedRun: {
      status: "succeeded",
      exitCode: 0,
      finishedAt: "2026-05-22T00:02:00.000Z",
      taskContextPackage: { packageId: "completed-package" },
    },
    persistTaskContextPackage(taskContextPackage) {
      persisted.push(taskContextPackage);
    },
  });

  assert.deepEqual(outcome, { applied: true });
  assert.equal(run.status, "succeeded");
  assert.equal(run.taskRecommender, taskRecommender);
  assert.deepEqual(persisted, [{ packageId: "completed-package" }]);
});

test("completed recommendation run outcome skips cancelled runs", async () => {
  const run = {
    id: "recommendation-run-1",
    status: "cancelled",
  };

  const outcome = await applyCompletedRecommendationRun({
    run,
    completedRun: {
      status: "succeeded",
      taskContextPackage: { packageId: "completed-package" },
    },
    persistTaskContextPackage() {
      throw new Error("cancelled run should not persist");
    },
  });

  assert.deepEqual(outcome, { applied: false });
  assert.deepEqual(run, {
    id: "recommendation-run-1",
    status: "cancelled",
  });
});

test("failed recommendation run outcome marks failed state", () => {
  const run = {
    id: "recommendation-run-1",
    status: "running",
  };

  const outcome = applyFailedRecommendationRun({
    run,
    error: new Error("command exploded"),
    now: () => "2026-05-22T00:00:00.000Z",
  });

  assert.deepEqual(outcome, { applied: true });
  assert.deepEqual(run, {
    id: "recommendation-run-1",
    status: "failed",
    finishedAt: "2026-05-22T00:00:00.000Z",
    taskRecommender: {
      status: "failed",
      startedAt: null,
      finishedAt: "2026-05-22T00:00:00.000Z",
      selectedPackageId: null,
      outputRef: null,
      error: "command exploded",
    },
    error: "command exploded",
  });
});

test("failed recommendation run outcome skips cancelled runs", () => {
  const run = {
    id: "recommendation-run-1",
    status: "cancelled",
  };

  const outcome = applyFailedRecommendationRun({
    run,
    error: new Error("command exploded"),
    now: () => {
      throw new Error("cancelled run should not mark failed");
    },
  });

  assert.deepEqual(outcome, { applied: false });
  assert.deepEqual(run, {
    id: "recommendation-run-1",
    status: "cancelled",
  });
});
