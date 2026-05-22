import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageRecommendationSyncController } from "../public/workflow-page-recommendation-sync-controller.js";

function createHarness({
  recommendationRun = {
    id: "recommendation-run:001",
    status: "running",
    taskContextPackage: { packageId: "package:fresh" },
  },
  snapshotState = {
    tasks: [{ fileName: "task-001.yaml" }],
    selectedFileName: "task-001.yaml",
    poolTaskContextPackages: [{ packageId: "package:fresh" }],
  },
} = {}) {
  const calls = [];
  let currentSnapshotState = snapshotState;
  const elements = { recommendationStatus: { textContent: "" } };
  const workflowApi = {
    async loadRecommendationRun() {
      calls.push(["loadRecommendationRun"]);
      return { recommendationRun };
    },
  };
  const controller = createWorkflowPageRecommendationSyncController({
    workflowApi,
    elements,
    getSnapshotState: () => currentSnapshotState,
    setSnapshotState(nextSnapshotState) {
      currentSnapshotState = nextSnapshotState;
      calls.push(["setSnapshotState", nextSnapshotState.poolTaskContextPackages]);
    },
    resolveActiveTaskContextPackage({ recommendationRun }) {
      calls.push(["resolveActiveTaskContextPackage", recommendationRun?.id ?? null]);
      return recommendationRun?.taskContextPackage ?? currentSnapshotState.poolTaskContextPackages[0];
    },
    renderRecommendationRun(payload) {
      calls.push([
        "renderRecommendationRun",
        payload.recommendationRun?.id ?? null,
        payload.activeTaskContextPackage?.packageId ?? null,
        payload.snapshotState,
      ]);
    },
  });

  return {
    calls,
    controller,
    elements,
    getSnapshotState: () => currentSnapshotState,
    workflowApi,
  };
}

test("workflow page recommendation sync controller loads, marks freshness, and renders active package", async () => {
  const harness = createHarness();

  await harness.controller.loadRecommendationRun();

  assert.equal(harness.controller.getRecommendationRun().id, "recommendation-run:001");
  assert.equal(harness.controller.isRecommendationRunRunning(), true);
  assert.equal(harness.controller.latestRecommendationSyncAt() > 0, true);
  assert.deepEqual(harness.calls, [
    ["loadRecommendationRun"],
    ["resolveActiveTaskContextPackage", "recommendation-run:001"],
    [
      "renderRecommendationRun",
      "recommendation-run:001",
      "package:fresh",
      harness.getSnapshotState(),
    ],
  ]);
});

test("workflow page recommendation sync controller syncs recommendation packages into snapshot state", () => {
  const harness = createHarness();
  const freshPackage = {
    packageId: "package:fresh",
    source: { path: "tasks/task-001.yaml" },
  };

  harness.controller.setRecommendationRun({
    id: "manual-run:001",
    taskContextPackage: freshPackage,
  }, { syncTaskPackage: true });

  assert.equal(harness.getSnapshotState().poolTaskContextPackages[0], freshPackage);
  assert.deepEqual(harness.calls, [
    ["setSnapshotState", [freshPackage]],
  ]);
});

test("workflow page recommendation sync controller renders connection interruptions for running runs", async () => {
  const harness = createHarness({
    recommendationRun: {
      id: "recommendation-run:001",
      status: "running",
      startedAt: new Date(Date.now() - 1000).toISOString(),
    },
  });
  await harness.controller.loadRecommendationRun();

  const didRender = harness.controller.markRecommendationConnectionInterrupted();

  assert.equal(didRender, true);
  assert.match(harness.elements.recommendationStatus.textContent, /^running · 连接中断 · /);
});

test("workflow page recommendation sync controller marks interrupted status during silent sync failures", async () => {
  const harness = createHarness();
  harness.controller.setRecommendationRun({
    id: "recommendation-run:001",
    status: "running",
    startedAt: new Date(Date.now() - 1000).toISOString(),
  });
  harness.workflowApi.loadRecommendationRun = async () => {
    throw new Error("offline");
  };

  await harness.controller.syncRecommendationRunSilently();

  assert.match(harness.elements.recommendationStatus.textContent, /^running · 连接中断 · /);
});
