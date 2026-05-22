import { test } from "node:test";
import assert from "node:assert/strict";
import {
  connectWorkflowPageShellEvents,
  startWorkflowPageInitialLoad,
  startWorkflowPageShellRefreshLoop,
} from "../public/workflow-page-shell-lifecycle.js";

function createDataController(calls, {
  loadTasks = async () => calls.push(["loadTasks"]),
  loadRecommendationRun = async () => calls.push(["loadRecommendationRun"]),
  loadTerminalSession = async () => calls.push(["loadTerminalSession"]),
} = {}) {
  return {
    isRecommendationRunRunning: () => true,
    latestRecommendationSyncAt: () => 123,
    loadRecommendationRun,
    loadTerminalSession,
    loadTasks,
    markRecommendationConnectionInterrupted: () => {
      calls.push(["markRecommendationConnectionInterrupted"]);
      return true;
    },
    renderRecommendationRun: () => calls.push(["renderRecommendationRun"]),
    syncRecommendationRunSilently: () => calls.push(["syncRecommendationRunSilently"]),
  };
}

test("workflow page shell lifecycle starts the initial page load", async () => {
  const calls = [];
  const workflowPageDataController = createDataController(calls);

  await startWorkflowPageInitialLoad({
    workflowPageDataController,
    showError: (error) => calls.push(["showError", error.message]),
  });

  assert.deepEqual(calls, [
    ["loadTasks"],
    ["loadRecommendationRun"],
    ["loadTerminalSession"],
  ]);
});

test("workflow page shell lifecycle routes initial load failures to showError", async () => {
  const calls = [];
  const workflowPageDataController = createDataController(calls, {
    loadTasks: async () => {
      calls.push(["loadTasks"]);
      throw new Error("snapshot failed");
    },
  });

  await startWorkflowPageInitialLoad({
    workflowPageDataController,
    showError: (error) => calls.push(["showError", error.message]),
  });

  assert.deepEqual(calls, [
    ["loadTasks"],
    ["loadRecommendationRun"],
    ["loadTerminalSession"],
    ["showError", "snapshot failed"],
  ]);
});

test("workflow page shell lifecycle connects event stream with controller callbacks", () => {
  const calls = [];
  const workflowPageDataController = createDataController(calls);

  const eventStream = connectWorkflowPageShellEvents({
    EventSourceCtor: "event-source",
    connectEventStream(options) {
      calls.push(["connectEventStream", options.EventSourceCtor]);
      options.loadTasks();
      options.loadRecommendationRun();
      options.loadTerminalSession();
      options.syncRecommendationRunSilently();
      options.onConnectionError();
      options.showError(new Error("stream failed"));
      return "event-stream";
    },
    workflowPageDataController,
    showError: (error) => calls.push(["showError", error.message]),
  });

  assert.equal(eventStream, "event-stream");
  assert.deepEqual(calls, [
    ["connectEventStream", "event-source"],
    ["loadTasks"],
    ["loadRecommendationRun"],
    ["loadTerminalSession"],
    ["syncRecommendationRunSilently"],
    ["markRecommendationConnectionInterrupted"],
    ["showError", "stream failed"],
  ]);
});

test("workflow page shell lifecycle starts refresh loop with recommendation callbacks", () => {
  const calls = [];
  const workflowPageDataController = createDataController(calls);

  const refreshLoop = startWorkflowPageShellRefreshLoop({
    startRefreshLoop(options) {
      calls.push(["startRefreshLoop"]);
      assert.equal(options.isRecommendationRunRunning(), true);
      assert.equal(options.latestRecommendationSyncAt(), 123);
      options.renderRecommendationRun();
      options.syncRecommendationRunSilently();
      return "refresh-loop";
    },
    workflowPageDataController,
  });

  assert.equal(refreshLoop, "refresh-loop");
  assert.deepEqual(calls, [
    ["startRefreshLoop"],
    ["renderRecommendationRun"],
    ["syncRecommendationRunSilently"],
  ]);
});
