import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cancelRecommendationRunAction,
  startRecommendationRunAction,
} from "../public/workflow-page-recommendation-run-actions.js";
import { WorkflowApiError } from "../public/workflow-api-client.js";

function createHarness({
  recommendationRun = { id: "recommendation-run:001" },
} = {}) {
  const calls = [];
  return {
    calls,
    workflowApi: {
      async startRecommendationRun() {
        calls.push(["startRecommendationRun"]);
        return { recommendationRun };
      },
      async cancelRecommendationRun() {
        calls.push(["cancelRecommendationRun"]);
        return { recommendationRun };
      },
    },
    setRecommendationRun(run, options) {
      calls.push(["setRecommendationRun", run, options]);
    },
    renderRecommendationRun() {
      calls.push(["renderRecommendationRun"]);
    },
    setRecommendationStatus(status) {
      calls.push(["recommendationStatus", status]);
    },
    setRecommendationResultText(text) {
      calls.push(["recommendationResult", text]);
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

test("recommendation run actions start a run and render the latest snapshot", async () => {
  const harness = createHarness();
  const runButton = button();
  const cancelButton = button();

  const result = await startRecommendationRunAction({
    ...harness,
    runRecommendationButton: runButton,
    cancelRecommendationButton: cancelButton,
  });

  assert.equal(result.ok, true);
  assert.equal(runButton.disabled, true);
  assert.equal(cancelButton.hidden, true);
  assert.deepEqual(harness.calls, [
    ["recommendationStatus", "启动中"],
    ["recommendationResult", "正在启动推荐器..."],
    ["startRecommendationRun"],
    ["setRecommendationRun", { id: "recommendation-run:001" }, undefined],
    ["renderRecommendationRun"],
  ]);
});

test("recommendation run actions render conflict runs from workflow API errors", async () => {
  const harness = createHarness();
  harness.workflowApi.startRecommendationRun = async () => {
    throw new WorkflowApiError("already running", {
      status: 409,
      payload: { recommendationRun: { id: "recommendation-run:running" } },
    });
  };

  const conflict = await startRecommendationRunAction({
    ...harness,
    runRecommendationButton: button(),
  });

  assert.equal(conflict.conflict, true);
  assert.deepEqual(harness.calls.at(-2), [
    "setRecommendationRun",
    { id: "recommendation-run:running" },
    undefined,
  ]);
});

test("recommendation run actions cancel a running run", async () => {
  const harness = createHarness();
  const cancelRecommendationButton = button();

  const result = await cancelRecommendationRunAction({
    ...harness,
    cancelRecommendationButton,
  });

  assert.equal(result.ok, true);
  assert.equal(cancelRecommendationButton.disabled, true);
  assert.equal(cancelRecommendationButton.textContent, "取消中");
  assert.deepEqual(harness.calls, [
    ["cancelRecommendationRun"],
    ["setRecommendationRun", { id: "recommendation-run:001" }, undefined],
    ["renderRecommendationRun"],
  ]);
});

test("recommendation run actions skip cancellation when the button is absent", async () => {
  const harness = createHarness();

  const result = await cancelRecommendationRunAction({
    ...harness,
    cancelRecommendationButton: null,
  });

  assert.deepEqual(result, { ok: false, skipped: true });
  assert.deepEqual(harness.calls, []);
});
