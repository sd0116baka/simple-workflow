import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageSnapshotLoader } from "../public/workflow-page-snapshot-loader.js";

function createHarness({
  snapshot = {
    tasks: [{ fileName: "task-001.yaml" }],
    taskPool: {
      entries: [{ fileName: "task-001.yaml" }],
      taskContextPackages: [{ packageId: "package:001" }],
    },
    startupCheck: { ok: true },
  },
  initialSnapshotState = {
    tasks: [],
    taskPool: { entries: [] },
    startupCheck: null,
    selectedFileName: null,
    poolTaskContextPackages: [],
  },
} = {}) {
  const calls = [];
  let snapshotState = initialSnapshotState;
  const dataRenderers = {
    renderList(nextSnapshotState) {
      calls.push(["renderList", nextSnapshotState.selectedFileName]);
    },
    renderLoadingState() {
      calls.push(["renderLoadingState"]);
    },
    renderMissingTaskSelection() {
      calls.push(["renderMissingTaskSelection"]);
    },
    renderStartupCheck(nextSnapshotState) {
      calls.push(["renderStartupCheck", nextSnapshotState.startupCheck]);
    },
    renderTaskPool(nextSnapshotState) {
      calls.push(["renderTaskPool", nextSnapshotState.selectedFileName]);
    },
  };
  const taskSelection = {
    selectTask(fileName) {
      calls.push(["selectTask", fileName]);
      return true;
    },
  };
  const workflowApi = {
    async loadWorkflowSnapshot() {
      calls.push(["loadWorkflowSnapshot"]);
      return snapshot;
    },
  };
  const loader = createWorkflowPageSnapshotLoader({
    workflowApi,
    dataRenderers,
    taskSelection,
    getSnapshotState: () => snapshotState,
    setSnapshotState(nextSnapshotState) {
      snapshotState = nextSnapshotState;
      calls.push(["setSnapshotState", nextSnapshotState.selectedFileName]);
    },
    renderRecommendationRun() {
      calls.push(["renderRecommendationRun"]);
    },
  });

  return {
    calls,
    getSnapshotState: () => snapshotState,
    loader,
  };
}

test("workflow page snapshot loader applies snapshots and renders the selected task flow", async () => {
  const harness = createHarness();

  await harness.loader.loadTasks();

  assert.equal(harness.getSnapshotState().selectedFileName, "task-001.yaml");
  assert.deepEqual(harness.calls, [
    ["renderLoadingState"],
    ["loadWorkflowSnapshot"],
    ["setSnapshotState", "task-001.yaml"],
    ["renderList", "task-001.yaml"],
    ["renderTaskPool", "task-001.yaml"],
    ["renderStartupCheck", { ok: true }],
    ["selectTask", "task-001.yaml"],
    ["renderRecommendationRun"],
  ]);
});

test("workflow page snapshot loader renders missing selection when snapshot has no tasks", async () => {
  const harness = createHarness({
    snapshot: {
      tasks: [],
      taskPool: { entries: [], taskContextPackages: [] },
      startupCheck: null,
    },
  });

  await harness.loader.loadTasks();

  assert.equal(harness.getSnapshotState().selectedFileName, null);
  assert.deepEqual(harness.calls, [
    ["renderLoadingState"],
    ["loadWorkflowSnapshot"],
    ["setSnapshotState", null],
    ["renderList", null],
    ["renderTaskPool", null],
    ["renderStartupCheck", null],
    ["renderMissingTaskSelection"],
    ["renderRecommendationRun"],
  ]);
});

test("workflow page snapshot loader preserves an existing selected task when still present", async () => {
  const harness = createHarness({
    snapshot: {
      tasks: [{ fileName: "task-001.yaml" }, { fileName: "task-002.yaml" }],
      taskPool: {
        entries: [{ fileName: "task-001.yaml" }, { fileName: "task-002.yaml" }],
        taskContextPackages: [{ packageId: "package:002" }],
      },
      startupCheck: { ok: true },
    },
    initialSnapshotState: {
      tasks: [{ fileName: "task-002.yaml" }],
      taskPool: { entries: [] },
      startupCheck: null,
      selectedFileName: "task-002.yaml",
      poolTaskContextPackages: [],
    },
  });

  await harness.loader.loadTasks();

  assert.equal(harness.getSnapshotState().selectedFileName, "task-002.yaml");
  assert.deepEqual(harness.calls, [
    ["renderLoadingState"],
    ["loadWorkflowSnapshot"],
    ["setSnapshotState", "task-002.yaml"],
    ["renderList", "task-002.yaml"],
    ["renderTaskPool", "task-002.yaml"],
    ["renderStartupCheck", { ok: true }],
    ["selectTask", "task-002.yaml"],
    ["renderRecommendationRun"],
  ]);
});
