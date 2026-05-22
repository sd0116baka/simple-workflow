import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecommendationRunLifecycleState } from "../src/workflow/recommendation-run-lifecycle-state.js";
import { createRunningRecommendationRunFixture } from "./support/recommendation-run-fixtures.js";

test("recommendation run lifecycle state allocates stable sequential ids", () => {
  const state = createRecommendationRunLifecycleState();

  assert.equal(state.nextRunId(), "recommendation-run-1");
  assert.equal(state.nextRunId(), "recommendation-run-2");
});

test("recommendation run lifecycle state supports custom id prefixes", () => {
  const state = createRecommendationRunLifecycleState({
    idPrefix: "test-run",
  });

  assert.equal(state.nextRunId(), "test-run-1");
});

test("recommendation run lifecycle state tracks latest run and running status", () => {
  const state = createRecommendationRunLifecycleState();
  const run = createRunningRecommendationRunFixture();

  assert.equal(state.getLatestRun(), null);
  assert.equal(state.hasRunningRun(), false);
  assert.equal(state.setLatestRun(run), run);
  assert.equal(state.getLatestRun(), run);
  assert.equal(state.hasRunningRun(), true);

  run.status = "succeeded";
  assert.equal(state.hasRunningRun(), false);
  assert.equal(state.setLatestRun(null), null);
  assert.equal(state.getLatestRun(), null);
});

test("recommendation run lifecycle state snapshots the latest run", () => {
  const state = createRecommendationRunLifecycleState();
  const run = createRunningRecommendationRunFixture({
    progress: [
      {
        timestamp: "2026-05-22T10:00:00.000Z",
        stage: "recommendation",
        message: "started",
      },
    ],
  });
  state.setLatestRun(run);

  const snapshot = state.snapshotLatestRun();
  snapshot.args.push("mutated");
  snapshot.progress[0].message = "mutated";

  assert.deepEqual(run.args, ["run"]);
  assert.equal(run.progress[0].message, "started");
});

test("recommendation run lifecycle state snapshots missing latest run as null", () => {
  const state = createRecommendationRunLifecycleState();

  assert.equal(state.snapshotLatestRun(), null);
});
