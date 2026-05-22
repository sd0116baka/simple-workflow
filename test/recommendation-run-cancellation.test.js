import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelRecommendationRunTransaction } from "../src/workflow/recommendation-run-cancellation.js";
import { createRecommendationRunLifecycleState } from "../src/workflow/recommendation-run-lifecycle-state.js";
import {
  createRunningRecommendationRunFixture,
  createSucceededRecommendationRunFixture,
} from "./support/recommendation-run-fixtures.js";

test("recommendation run cancellation returns a clear result without a latest run", () => {
  const state = createRecommendationRunLifecycleState();
  const abortedRunIds = [];
  const emitted = [];

  const result = cancelRecommendationRunTransaction({
    recommendationRunLifecycleState: state,
    recommendationRunControllerRegistry: {
      abort(runId) {
        abortedRunIds.push(runId);
      },
    },
    emitRecommendationChanged(run) {
      emitted.push(run);
    },
  });

  assert.equal(result.cancelled, false);
  assert.match(result.error, /没有正在运行/);
  assert.equal(result.recommendationRun, null);
  assert.deepEqual(abortedRunIds, []);
  assert.deepEqual(emitted, []);
});

test("recommendation run cancellation rejects terminal latest runs with a snapshot", () => {
  const state = createRecommendationRunLifecycleState();
  const run = createSucceededRecommendationRunFixture();
  state.setLatestRun(run);

  const result = cancelRecommendationRunTransaction({
    recommendationRunLifecycleState: state,
    recommendationRunControllerRegistry: {
      abort() {
        throw new Error("terminal run should not abort");
      },
    },
    emitRecommendationChanged() {
      throw new Error("terminal run should not emit");
    },
  });

  assert.equal(result.cancelled, false);
  assert.match(result.error, /没有正在运行/);
  assert.equal(result.recommendationRun.id, "recommendation-run-1");
  assert.notEqual(result.recommendationRun, run);
});

test("recommendation run cancellation cancels running run, aborts controller, and emits", () => {
  const state = createRecommendationRunLifecycleState();
  const run = createRunningRecommendationRunFixture();
  const abortedRunIds = [];
  const emitted = [];
  state.setLatestRun(run);

  const result = cancelRecommendationRunTransaction({
    recommendationRunLifecycleState: state,
    recommendationRunControllerRegistry: {
      abort(runId) {
        abortedRunIds.push(runId);
      },
    },
    emitRecommendationChanged(inputRun) {
      emitted.push(inputRun);
    },
  });

  assert.equal(result.cancelled, true);
  assert.equal(result.error, null);
  assert.equal(result.recommendationRun.status, "cancelled");
  assert.equal(result.recommendationRun.error, "cancelled");
  assert.equal(state.getLatestRun().status, "cancelled");
  assert.deepEqual(abortedRunIds, ["recommendation-run-1"]);
  assert.deepEqual(emitted, [run]);
  assert.equal(run.progress.at(-1).type, "cancel_requested");
  assert.equal(run.progress.at(-1).stream, "system");
});

test("recommendation run cancellation accepts injected cancellation policy", () => {
  const state = createRecommendationRunLifecycleState();
  const run = createRunningRecommendationRunFixture();
  state.setLatestRun(run);

  const result = cancelRecommendationRunTransaction({
    recommendationRunLifecycleState: state,
    recommendationRunControllerRegistry: {
      abort() {
        throw new Error("custom policy did not cancel");
      },
    },
    emitRecommendationChanged() {
      throw new Error("custom policy did not cancel");
    },
    requestCancellation(inputRun) {
      assert.equal(inputRun, run);
      return {
        cancelled: false,
        error: "custom rejection",
        run: inputRun,
      };
    },
  });

  assert.equal(result.cancelled, false);
  assert.equal(result.error, "custom rejection");
  assert.equal(result.recommendationRun.id, "recommendation-run-1");
});
