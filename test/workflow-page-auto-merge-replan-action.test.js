import { test } from "node:test";
import assert from "node:assert/strict";
import { isActionFeedbackPending } from "../public/workflow-action-feedback.js";
import { WorkflowApiError } from "../public/workflow-api-client.js";
import { replanAutoMergeAction } from "../public/workflow-page-auto-merge-replan-action.js";

function createHarness({
  taskContextPackage = { packageId: "task-context-package:tasks/task-001.yaml" },
  recommendationRun = { id: "recommendation-run:001" },
} = {}) {
  const calls = [];
  return {
    calls,
    workflowApi: {
      async replanAutoMerge(payload) {
        calls.push(["replanAutoMerge", payload]);
        return { recommendationRun };
      },
    },
    activeTaskContextPackage: () => taskContextPackage,
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
    closest: () => ({
      querySelector: () => ({ textContent: "" }),
    }),
  };
}

test("auto merge replan action syncs the latest recommendation run", async () => {
  const harness = createHarness();
  const result = await replanAutoMergeAction({
    ...harness,
    actionButton: button(),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls, [
    ["autoMergeStatus", "规划中"],
    ["replanAutoMerge", { packageId: "task-context-package:tasks/task-001.yaml" }],
    ["setRecommendationRun", { id: "recommendation-run:001" }, { syncTaskPackage: true }],
    ["renderRecommendationRun"],
    ["loadTasks"],
  ]);
});

test("auto merge replan action reports planning failures without refreshing", async () => {
  const feedback = { textContent: "" };
  const actionButton = {
    ...button(),
    closest: () => ({
      querySelector: () => feedback,
    }),
  };
  const harness = createHarness();
  harness.workflowApi.replanAutoMerge = async () => {
    throw new Error("git dirty");
  };

  const result = await replanAutoMergeAction({ ...harness, actionButton });

  assert.equal(result.ok, false);
  assert.equal(actionButton.disabled, false);
  assert.equal(actionButton.textContent, "重新生成合并计划");
  assert.equal(isActionFeedbackPending(actionButton), false);
  assert.equal(feedback.textContent, "重新生成合并计划失败：git dirty");
  assert.deepEqual(harness.calls, [
    ["autoMergeStatus", "规划中"],
    ["autoMergeStatus", "规划失败"],
  ]);
});

test("auto merge replan action preserves workflow API error messages", async () => {
  const feedback = { textContent: "" };
  const actionButton = {
    ...button(),
    closest: () => ({
      querySelector: () => feedback,
    }),
  };
  const harness = createHarness();
  harness.workflowApi.replanAutoMerge = async () => {
    throw new WorkflowApiError("计划被拒绝", {
      status: 409,
      payload: { error: "blocked" },
    });
  };

  await replanAutoMergeAction({ ...harness, actionButton });

  assert.equal(feedback.textContent, "计划被拒绝");
});
