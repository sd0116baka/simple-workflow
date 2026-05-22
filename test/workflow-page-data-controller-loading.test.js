import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowPageDataControllerHarness,
  createWorkflowPageTaskContextPackage,
} from "./support/workflow-page-data-controller-fixtures.js";

test("workflow page data controller loads snapshot and renders selected task flow", async () => {
  const harness = createWorkflowPageDataControllerHarness();

  await harness.controller.loadTasks();

  assert.equal(harness.controller.getSelectedFileName(), "task-001.yaml");
  assert.equal(harness.elements.rawText.textContent, "正在读取 tasks/ ...");
  assert.equal(harness.elements.parseStatus.textContent, "等待载入");
  assert.deepEqual(harness.calls, [
    ["loadWorkflowSnapshot"],
    ["renderTaskSource", "task-001.yaml", 1],
    ["renderTaskPool", "task-001.yaml", 1],
    ["renderStartupCheck", { ok: true }],
    ["renderSelectedTask", "task-001.yaml"],
    ["renderTaskSource", "task-001.yaml", 1],
    ["renderTaskPool", "task-001.yaml", 1],
    ["renderRecommendationRun", null, 1, "task-context-package:tasks/task-001.yaml"],
    ["renderRecommendationRun", null, 1, "task-context-package:tasks/task-001.yaml"],
  ]);
});

test("workflow page data controller renders missing selection when no tasks exist", async () => {
  const harness = createWorkflowPageDataControllerHarness({
    snapshot: {
      tasks: [],
      taskPool: { entries: [], taskContextPackages: [] },
      startupCheck: null,
    },
  });

  await harness.controller.loadTasks();

  assert.equal(harness.controller.getSelectedFileName(), null);
  assert.deepEqual(harness.calls, [
    ["loadWorkflowSnapshot"],
    ["renderTaskSource", null, 0],
    ["renderTaskPool", null, 0],
    ["renderStartupCheck", null],
    ["renderMissingTaskSelection"],
    ["renderRecommendationRun", null, 0, null],
  ]);
});

test("workflow page data controller resolves recommendation task packages as active state", async () => {
  const stalePackage = createWorkflowPageTaskContextPackage({ stage: "human-decision" });
  const freshPackage = createWorkflowPageTaskContextPackage({ stage: "auto-merge-planning" });
  const harness = createWorkflowPageDataControllerHarness({
    snapshot: {
      tasks: [{ fileName: "task-001.yaml" }],
      taskPool: {
        entries: [{ fileName: "task-001.yaml" }],
        taskContextPackages: [stalePackage],
      },
      startupCheck: { ok: true },
    },
  });

  await harness.controller.loadTasks();
  harness.controller.setRecommendationRun({
    id: "manual-run:001",
    taskContextPackage: freshPackage,
  }, { syncTaskPackage: true });

  assert.equal(harness.controller.activeTaskContextPackage(), freshPackage);
});
