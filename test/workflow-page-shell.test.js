import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageShell } from "../public/workflow-page-shell.js";

function createHarness({
  loadTasks = async () => {},
  loadRecommendationRun = async () => {},
  loadTerminalSession = async () => {},
} = {}) {
  const calls = [];
  const elements = {
    selectedTitle: "selectedTitle",
    selectedMeta: "selectedMeta",
    rawText: "rawText",
    parsedText: "parsedText",
    validationResult: "validationResult",
    startupCheckPanel: "startupCheckPanel",
    parseStatus: "parseStatus",
    validationStatus: "validationStatus",
    startupCheckStatus: "startupCheckStatus",
    recommendationStatus: "recommendationStatus",
    humanDecisionStatus: "humanDecisionStatus",
    recommendationResult: "recommendationResult",
    runRecommendationButton: "runRecommendationButton",
    seedStateFixturesButton: "seedStateFixturesButton",
    cleanupStateFixturesButton: "cleanupStateFixturesButton",
    cancelRecommendationButton: "cancelRecommendationButton",
  };
  const workflowApi = { id: "workflow-api" };
  const dataController = {
    isRecommendationRunRunning: () => true,
    latestRecommendationSyncAt: () => 1000,
    loadRecommendationRun: async () => {
      calls.push(["loadRecommendationRun"]);
      await loadRecommendationRun();
    },
    loadTasks: async () => {
      calls.push(["loadTasks"]);
      await loadTasks();
    },
    loadTerminalSession: async () => {
      calls.push(["loadTerminalSession"]);
      await loadTerminalSession();
    },
    markRecommendationConnectionInterrupted: () => {
      calls.push(["markRecommendationConnectionInterrupted"]);
      return true;
    },
    syncRecommendationRunSilently: () => calls.push(["syncRecommendationRunSilently"]),
  };
  const commands = {
    bindPageControls: () => calls.push(["bindPageControls"]),
  };
  const shell = createWorkflowPageShell({
    workflowApi,
    elements,
    EventSourceCtor: "event-source",
    createErrorRenderer({ elements: errorElements }) {
      calls.push(["createErrorRenderer", errorElements]);
      return {
        render(error) {
          calls.push(["renderError", error.message]);
        },
      };
    },
    createModuleGraph(options) {
      calls.push(["createModuleGraph", options]);
      return {
        workflowPageCommands: commands,
        workflowPageDataController: dataController,
      };
    },
    connectEventStream(options) {
      calls.push(["connectEventStream", options]);
      return "event-stream";
    },
    startRefreshLoop(options) {
      calls.push(["startRefreshLoop", options]);
      return "refresh-loop";
    },
  });

  return {
    calls,
    commands,
    dataController,
    elements,
    shell,
    workflowApi,
  };
}

test("workflow page shell creates module graph and starts page lifecycle", async () => {
  const harness = createHarness();

  const started = harness.shell.start();
  await started.initialLoad;

  assert.equal(started.eventStream, "event-stream");
  assert.equal(started.refreshLoop, "refresh-loop");
  assert.deepEqual(harness.calls.map((call) => call[0]), [
    "createErrorRenderer",
    "createModuleGraph",
    "bindPageControls",
    "loadTasks",
    "loadRecommendationRun",
    "loadTerminalSession",
    "connectEventStream",
    "startRefreshLoop",
  ]);

  const moduleGraphOptions = harness.calls.find((call) => call[0] === "createModuleGraph")[1];
  assert.equal(moduleGraphOptions.workflowApi, harness.workflowApi);
  assert.equal(moduleGraphOptions.elements, harness.elements);
  moduleGraphOptions.showError(new Error("module graph failed"));
  assert.deepEqual(harness.calls.at(-1), ["renderError", "module graph failed"]);
});

test("workflow page shell routes event connection callbacks through data controller", () => {
  const harness = createHarness();

  harness.shell.connectWorkflowEvents();
  const connectedEventOptions = harness.calls.at(-1)[1];
  connectedEventOptions.onConnectionError();

  assert.deepEqual(harness.calls.slice(-2), [
    ["connectEventStream", connectedEventOptions],
    ["markRecommendationConnectionInterrupted"],
  ]);
});

test("workflow page shell routes initial load failures through the error renderer", async () => {
  const harness = createHarness({
    loadTasks: async () => {
      throw new Error("snapshot failed");
    },
  });

  await harness.shell.start().initialLoad;

  assert.deepEqual(harness.calls.at(-1), ["renderError", "snapshot failed"]);
});
