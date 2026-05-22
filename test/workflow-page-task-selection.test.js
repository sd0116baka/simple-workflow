import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageTaskSelection } from "../public/workflow-page-task-selection.js";

function createHarness({
  initialSnapshotState = {
    tasks: [{ fileName: "task-001.yaml" }],
    selectedFileName: null,
  },
  renderSelectedTask = () => true,
} = {}) {
  const calls = [];
  let snapshotState = initialSnapshotState;
  const taskSelection = createWorkflowPageTaskSelection({
    dataRenderers: {
      renderSelectedTask(nextSnapshotState) {
        calls.push(["renderSelectedTask", nextSnapshotState.selectedFileName]);
        return renderSelectedTask(nextSnapshotState);
      },
    },
    getSnapshotState: () => snapshotState,
    setSnapshotState(nextSnapshotState) {
      snapshotState = nextSnapshotState;
      calls.push(["setSnapshotState", nextSnapshotState.selectedFileName]);
    },
    renderList() {
      calls.push(["renderList", snapshotState.selectedFileName]);
    },
    renderTaskPool() {
      calls.push(["renderTaskPool", snapshotState.selectedFileName]);
    },
    renderRecommendationRun() {
      calls.push(["renderRecommendationRun", snapshotState.selectedFileName]);
    },
  });

  return {
    calls,
    getSnapshotState: () => snapshotState,
    taskSelection,
  };
}

test("workflow page task selection updates selected file and rerenders dependent sections", () => {
  const harness = createHarness();

  const didSelect = harness.taskSelection.selectTask("task-001.yaml");

  assert.equal(didSelect, true);
  assert.equal(harness.taskSelection.getSelectedFileName(), "task-001.yaml");
  assert.equal(harness.getSnapshotState().selectedFileName, "task-001.yaml");
  assert.deepEqual(harness.calls, [
    ["setSnapshotState", "task-001.yaml"],
    ["renderSelectedTask", "task-001.yaml"],
    ["renderList", "task-001.yaml"],
    ["renderTaskPool", "task-001.yaml"],
    ["renderRecommendationRun", "task-001.yaml"],
  ]);
});

test("workflow page task selection stops dependent rerenders when selected task is missing", () => {
  const harness = createHarness({
    renderSelectedTask: () => false,
  });

  const didSelect = harness.taskSelection.selectTask("missing.yaml");

  assert.equal(didSelect, false);
  assert.equal(harness.taskSelection.getSelectedFileName(), "missing.yaml");
  assert.deepEqual(harness.calls, [
    ["setSnapshotState", "missing.yaml"],
    ["renderSelectedTask", "missing.yaml"],
  ]);
});

test("workflow page task selection can update selected file without rendering", () => {
  const harness = createHarness();

  harness.taskSelection.setSelectedFileName("task-002.yaml");

  assert.equal(harness.taskSelection.getSelectedFileName(), "task-002.yaml");
  assert.deepEqual(harness.calls, [
    ["setSnapshotState", "task-002.yaml"],
  ]);
});
