import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptConvergenceAction,
  cancelTaskAction,
  continueConvergenceWithGuidanceAction,
} from "../public/workflow-page-manual-actions.js";

function createHarness({
  taskContextPackage = { packageId: "task-context-package:tasks/task-001.yaml" },
  recommendationRun = { id: "recommendation-run:001" },
} = {}) {
  const calls = [];
  return {
    calls,
    workflowApi: {
      async acceptConvergence(payload) {
        calls.push(["acceptConvergence", payload]);
        return { recommendationRun };
      },
      async continueConvergenceWithGuidance(payload) {
        calls.push(["continueConvergenceWithGuidance", payload]);
        return { recommendationRun };
      },
      async cancelTask(payload) {
        calls.push(["cancelTask", payload]);
        return { recommendationRun };
      },
      async replanAutoMerge(payload) {
        calls.push(["replanAutoMerge", payload]);
        return { recommendationRun };
      },
    },
    activeTaskContextPackage: () => taskContextPackage,
    setHumanDecisionStatus(status) {
      calls.push(["humanDecisionStatus", status]);
    },
    setAutoMergeStatus(status) {
      calls.push(["autoMergeStatus", status]);
    },
    setRecommendationRun(run, options) {
      calls.push(["setRecommendationRun", run, options]);
    },
    renderRecommendationRun() {
      calls.push(["renderRecommendationRun"]);
    },
    async loadTasks() {
      calls.push(["loadTasks"]);
    },
  };
}

function button() {
  return {
    dataset: {},
    disabled: false,
    hidden: false,
    textContent: "",
  };
}

test("manual workflow actions call the workflow API and refresh task state", async () => {
  const harness = createHarness();
  const actionButton = button();

  await acceptConvergenceAction({ ...harness, actionButton });

  assert.equal(actionButton.disabled, true);
  assert.equal(actionButton.textContent, "提交中");
  assert.deepEqual(harness.calls, [
    ["humanDecisionStatus", "提交中"],
    ["acceptConvergence", { packageId: "task-context-package:tasks/task-001.yaml" }],
    ["setRecommendationRun", { id: "recommendation-run:001" }, { syncTaskPackage: true }],
    ["renderRecommendationRun"],
    ["loadTasks"],
  ]);
});

test("manual workflow actions preserve guidance and cancellation payloads", async () => {
  const continueHarness = createHarness();
  await continueConvergenceWithGuidanceAction({
    ...continueHarness,
    guidance: "补充测试",
    expectedNextOutcome: "success",
    actionButton: button(),
  });
  assert.deepEqual(continueHarness.calls[1], [
    "continueConvergenceWithGuidance",
    {
      packageId: "task-context-package:tasks/task-001.yaml",
      guidance: "补充测试",
      expectedNextOutcome: "success",
    },
  ]);

  const cancelHarness = createHarness({ taskContextPackage: null });
  await cancelTaskAction({ ...cancelHarness, actionButton: button() });
  assert.deepEqual(cancelHarness.calls[1], ["cancelTask", { packageId: null }]);
});
