import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkflowApiError } from "../public/workflow-api-client.js";
import { createWorkflowPageRecommendationRunCommands } from "../public/workflow-page-recommendation-run-commands.js";

function createButton({ textContent = "" } = {}) {
  return {
    dataset: {},
    disabled: false,
    hidden: false,
    textContent,
  };
}

function createHarness() {
  const calls = [];
  const elements = {
    runRecommendationButton: createButton({ textContent: "只运行推荐探针" }),
    runWorkflowButton: createButton({ textContent: "运行完整 Agent 流程" }),
    cancelRecommendationButton: createButton({ textContent: "取消运行" }),
  };
  const workflowApi = {
    async startRecommendationRun(input) {
      calls.push(["startRecommendationRun", input]);
      return { recommendationRun: { id: "recommendation-run:001" } };
    },
    async cancelRecommendationRun() {
      calls.push(["cancelRecommendationRun"]);
      return { recommendationRun: null };
    },
  };
  const commands = createWorkflowPageRecommendationRunCommands({
    workflowApi,
    setRecommendationRun: (run) => calls.push(["setRecommendationRun", run]),
    renderRecommendationRun: () => calls.push(["renderRecommendationRun"]),
    pageStatus: {
      setRecommendationStatus: (text) => calls.push(["setRecommendationStatus", text]),
      setRecommendationResultText: (text) => calls.push(["setRecommendationResultText", text]),
    },
    elements,
  });

  return {
    calls,
    commands,
    elements,
    workflowApi,
  };
}

test("workflow page recommendation run commands start a recommendation run", async () => {
  const harness = createHarness();

  const result = await harness.commands.createRecommendationRun();

  assert.equal(result.ok, true);
  assert.equal(harness.elements.runWorkflowButton.disabled, true);
  assert.equal(harness.elements.cancelRecommendationButton.hidden, true);
  assert.deepEqual(harness.calls, [
    ["setRecommendationStatus", "启动中"],
    ["setRecommendationResultText", "正在启动完整 Agent 流程..."],
    ["startRecommendationRun", { mode: "workflow" }],
    ["setRecommendationRun", { id: "recommendation-run:001" }],
    ["renderRecommendationRun"],
  ]);
});

test("workflow page recommendation run commands start a probe run", async () => {
  const harness = createHarness();

  const result = await harness.commands.createRecommendationRun({ mode: "probe" });

  assert.equal(result.ok, true);
  assert.equal(harness.elements.runRecommendationButton.disabled, true);
  assert.equal(harness.elements.runWorkflowButton.disabled, true);
  assert.deepEqual(harness.calls, [
    ["setRecommendationStatus", "启动中"],
    ["setRecommendationResultText", "正在启动推荐探针..."],
    ["startRecommendationRun", { mode: "probe" }],
    ["setRecommendationRun", { id: "recommendation-run:001" }],
    ["renderRecommendationRun"],
  ]);
});

test("workflow page recommendation run commands render conflict runs", async () => {
  const harness = createHarness();
  const conflictRun = { id: "recommendation-run:running" };
  harness.workflowApi.startRecommendationRun = async (input) => {
    harness.calls.push(["startRecommendationRun", input]);
    throw new WorkflowApiError("already running", {
      status: 409,
      payload: { recommendationRun: conflictRun },
    });
  };

  const result = await harness.commands.createRecommendationRun();

  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.deepEqual(harness.calls, [
    ["setRecommendationStatus", "启动中"],
    ["setRecommendationResultText", "正在启动完整 Agent 流程..."],
    ["startRecommendationRun", { mode: "workflow" }],
    ["setRecommendationRun", conflictRun],
    ["renderRecommendationRun"],
  ]);
});

test("workflow page recommendation run commands cancel a running recommendation run", async () => {
  const harness = createHarness();

  const result = await harness.commands.cancelRecommendationRun();

  assert.equal(result.ok, true);
  assert.equal(harness.elements.cancelRecommendationButton.disabled, true);
  assert.equal(harness.elements.cancelRecommendationButton.textContent, "取消中");
  assert.deepEqual(harness.calls, [
    ["cancelRecommendationRun"],
    ["setRecommendationRun", null],
    ["renderRecommendationRun"],
  ]);
});

test("workflow page recommendation run commands skip cancel when the button is absent", async () => {
  const calls = [];
  const commands = createWorkflowPageRecommendationRunCommands({
    workflowApi: {
      async cancelRecommendationRun() {
        calls.push(["cancelRecommendationRun"]);
        return { recommendationRun: null };
      },
    },
    setRecommendationRun: (run) => calls.push(["setRecommendationRun", run]),
    renderRecommendationRun: () => calls.push(["renderRecommendationRun"]),
    pageStatus: {
      setRecommendationStatus: () => {},
      setRecommendationResultText: () => {},
    },
    elements: {
      runRecommendationButton: createButton(),
      cancelRecommendationButton: null,
    },
  });

  const result = await commands.cancelRecommendationRun();

  assert.deepEqual(result, { ok: false, skipped: true });
  assert.deepEqual(calls, []);
});
