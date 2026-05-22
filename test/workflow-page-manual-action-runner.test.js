import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runManualWorkflowAction,
  syncManualActionRecommendationRun,
} from "../public/workflow-page-manual-action-runner.js";

function button() {
  return {
    dataset: {},
    disabled: false,
    textContent: "",
  };
}

test("manual action runner resolves package id, marks feedback, and syncs recommendation run", async () => {
  const calls = [];
  const actionButton = button();
  const payload = { recommendationRun: { id: "manual-run:001" } };
  const workflowApi = { id: "workflow-api" };

  const result = await runManualWorkflowAction({
    workflowApi,
    activeTaskContextPackage: () => ({
      packageId: "task-context-package:tasks/task-001.yaml",
    }),
    setStatus: (status) => calls.push(["setStatus", status]),
    setRecommendationRun: (run, options) =>
      calls.push(["setRecommendationRun", run, options]),
    renderRecommendationRun: () => calls.push(["renderRecommendationRun"]),
    loadTasks: async () => calls.push(["loadTasks"]),
    actionButton,
    feedbackText: "提交中",
    statusText: "提交中",
    async run(args) {
      calls.push(["run", args.workflowApi, args.packageId]);
      return payload;
    },
  });

  assert.equal(result, payload);
  assert.equal(actionButton.disabled, true);
  assert.equal(actionButton.textContent, "提交中");
  assert.deepEqual(calls, [
    ["setStatus", "提交中"],
    ["run", workflowApi, "task-context-package:tasks/task-001.yaml"],
    ["setRecommendationRun", { id: "manual-run:001" }, { syncTaskPackage: true }],
    ["renderRecommendationRun"],
    ["loadTasks"],
  ]);
});

test("manual action runner uses null package id when no active package exists", async () => {
  const calls = [];

  await runManualWorkflowAction({
    workflowApi: {},
    activeTaskContextPackage: () => null,
    setStatus: () => {},
    setRecommendationRun: () => {},
    renderRecommendationRun: () => {},
    loadTasks: async () => {},
    feedbackText: "取消中",
    statusText: "取消中",
    async run({ packageId }) {
      calls.push(["run", packageId]);
      return { recommendationRun: null };
    },
  });

  assert.deepEqual(calls, [["run", null]]);
});

test("manual action recommendation sync updates run before rendering and task refresh", async () => {
  const calls = [];

  await syncManualActionRecommendationRun({
    payload: { recommendationRun: { id: "manual-run:sync" } },
    setRecommendationRun: (run, options) =>
      calls.push(["setRecommendationRun", run, options]),
    renderRecommendationRun: () => calls.push(["renderRecommendationRun"]),
    loadTasks: async () => calls.push(["loadTasks"]),
  });

  assert.deepEqual(calls, [
    ["setRecommendationRun", { id: "manual-run:sync" }, { syncTaskPackage: true }],
    ["renderRecommendationRun"],
    ["loadTasks"],
  ]);
});
