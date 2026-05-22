import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowPageRecommendationSyncState,
  isWorkflowPageRecommendationRunRunning,
  markWorkflowPageRecommendationSynced,
  renderWorkflowRecommendationConnectionInterrupted,
  setWorkflowPageRecommendationRun,
} from "../public/workflow-page-recommendation-sync-state.js";

function element() {
  return { textContent: "" };
}

test("recommendation sync state starts without a run or freshness timestamp", () => {
  assert.deepEqual(createWorkflowPageRecommendationSyncState(), {
    recommendationRun: null,
    latestSyncAt: 0,
  });
});

test("recommendation sync state stores and clears recommendation runs", () => {
  const runningRun = { id: "recommendation-run:001", status: "running" };
  let state = createWorkflowPageRecommendationSyncState();

  state = setWorkflowPageRecommendationRun(state, runningRun);

  assert.equal(state.recommendationRun, runningRun);
  assert.equal(isWorkflowPageRecommendationRunRunning(state), true);

  state = setWorkflowPageRecommendationRun(state, undefined);

  assert.equal(state.recommendationRun, null);
  assert.equal(isWorkflowPageRecommendationRunRunning(state), false);
});

test("recommendation sync state records the latest sync time", () => {
  const state = markWorkflowPageRecommendationSynced(
    createWorkflowPageRecommendationSyncState(),
    { now: () => 12345 },
  );

  assert.equal(state.latestSyncAt, 12345);
});

test("recommendation sync state renders interrupted status for running runs", () => {
  const recommendationStatus = element();
  const state = setWorkflowPageRecommendationRun(
    createWorkflowPageRecommendationSyncState(),
    {
      id: "recommendation-run:001",
      status: "running",
      startedAt: new Date(Date.now() - 1000).toISOString(),
    },
  );

  const didRender = renderWorkflowRecommendationConnectionInterrupted({
    elements: { recommendationStatus },
    recommendationSyncState: state,
  });

  assert.equal(didRender, true);
  assert.match(recommendationStatus.textContent, /^running · 连接中断 · /);
});

test("recommendation sync state ignores interrupted status for terminal runs", () => {
  const recommendationStatus = element();
  const state = setWorkflowPageRecommendationRun(
    createWorkflowPageRecommendationSyncState(),
    {
      id: "recommendation-run:001",
      status: "completed",
      startedAt: new Date(Date.now() - 1000).toISOString(),
    },
  );

  const didRender = renderWorkflowRecommendationConnectionInterrupted({
    elements: { recommendationStatus },
    recommendationSyncState: state,
  });

  assert.equal(didRender, false);
  assert.equal(recommendationStatus.textContent, "");
});
