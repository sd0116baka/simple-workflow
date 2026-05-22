import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyWorkflowPageSnapshot,
  createEmptyWorkflowPageSnapshotState,
  syncWorkflowPageSnapshotRecommendationPackage,
} from "../public/workflow-page-snapshot-state.js";

test("workflow page snapshot state starts with empty page data", () => {
  assert.deepEqual(createEmptyWorkflowPageSnapshotState(), {
    tasks: [],
    poolEntries: [],
    poolTaskContextPackages: [],
    startupCheck: null,
    selectedFileName: null,
  });
});

test("workflow page snapshot state keeps a still-existing selected task", () => {
  const state = applyWorkflowPageSnapshot({
    snapshot: {
      tasks: [
        { fileName: "task-001.yaml" },
        { fileName: "task-002.yaml" },
      ],
      taskPool: {
        entries: [{ fileName: "task-002.yaml" }],
        taskContextPackages: [{ packageId: "task-context-package:002" }],
      },
      startupCheck: { ok: true },
    },
    selectedFileName: "task-002.yaml",
  });

  assert.deepEqual(state, {
    tasks: [
      { fileName: "task-001.yaml" },
      { fileName: "task-002.yaml" },
    ],
    poolEntries: [{ fileName: "task-002.yaml" }],
    poolTaskContextPackages: [{ packageId: "task-context-package:002" }],
    startupCheck: { ok: true },
    selectedFileName: "task-002.yaml",
  });
});

test("workflow page snapshot state falls back to the first task when selection disappears", () => {
  const state = applyWorkflowPageSnapshot({
    snapshot: {
      tasks: [
        { fileName: "task-001.yaml" },
        { fileName: "task-002.yaml" },
      ],
    },
    selectedFileName: "missing.yaml",
  });

  assert.equal(state.selectedFileName, "task-001.yaml");
  assert.deepEqual(state.poolEntries, []);
  assert.deepEqual(state.poolTaskContextPackages, []);
  assert.equal(state.startupCheck, null);
});

test("workflow page snapshot state clears selection when no tasks exist", () => {
  const state = applyWorkflowPageSnapshot({
    snapshot: {
      tasks: [],
      taskPool: {
        entries: [{ fileName: "stale.yaml" }],
        taskContextPackages: [{ packageId: "stale" }],
      },
      startupCheck: { ok: false },
    },
    selectedFileName: "task-001.yaml",
  });

  assert.equal(state.selectedFileName, null);
  assert.deepEqual(state.poolEntries, [{ fileName: "stale.yaml" }]);
  assert.deepEqual(state.poolTaskContextPackages, [{ packageId: "stale" }]);
  assert.deepEqual(state.startupCheck, { ok: false });
});

test("workflow page snapshot state replaces matching packages from recommendation runs", () => {
  const stalePackage = {
    packageId: "task-context-package:001",
    currentWorkStage: "human-decision",
  };
  const freshPackage = {
    packageId: "task-context-package:001",
    currentWorkStage: "auto-merge-planning",
  };
  const unchangedPackage = {
    packageId: "task-context-package:002",
    currentWorkStage: "task-pool",
  };
  const snapshotState = {
    ...createEmptyWorkflowPageSnapshotState(),
    poolTaskContextPackages: [stalePackage, unchangedPackage],
  };

  const syncedState = syncWorkflowPageSnapshotRecommendationPackage({
    snapshotState,
    recommendationRun: { taskContextPackage: freshPackage },
  });

  assert.deepEqual(syncedState.poolTaskContextPackages, [
    freshPackage,
    unchangedPackage,
  ]);
});

test("workflow page snapshot state preserves packages when recommendation run has no package", () => {
  const poolTaskContextPackages = [{ packageId: "task-context-package:001" }];
  const snapshotState = {
    ...createEmptyWorkflowPageSnapshotState(),
    poolTaskContextPackages,
  };

  const syncedState = syncWorkflowPageSnapshotRecommendationPackage({
    snapshotState,
    recommendationRun: { id: "recommendation-run:001" },
  });

  assert.equal(syncedState.poolTaskContextPackages, poolTaskContextPackages);
});
