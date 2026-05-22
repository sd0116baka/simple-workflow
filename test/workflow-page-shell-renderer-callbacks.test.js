import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowOverviewRendererCallbacks,
  createWorkflowPanelRendererCallbacks,
  createWorkflowRecommendationRunRendererCallbacks,
} from "../public/workflow-page-shell-renderer-callbacks.js";

test("workflow page shell renderer callbacks route panel actions through commands", () => {
  const calls = [];
  const commands = {
    acceptConvergence: (...args) => calls.push(["acceptConvergence", args]),
    cancelTask: (...args) => calls.push(["cancelTask", args]),
    continueConvergenceWithGuidance: (...args) =>
      calls.push(["continueConvergenceWithGuidance", args]),
  };
  const callbacks = createWorkflowPanelRendererCallbacks({
    getCommands: () => commands,
    showError: (error) => calls.push(["showError", error.message]),
  });

  callbacks.onAcceptConvergence("accept-button");
  callbacks.onContinueConvergenceWithGuidance({ guidance: "继续" });
  callbacks.onCancelTask("cancel-button");
  callbacks.showError(new Error("panel failed"));

  assert.deepEqual(calls, [
    ["acceptConvergence", ["accept-button"]],
    ["continueConvergenceWithGuidance", [{ guidance: "继续" }]],
    ["cancelTask", ["cancel-button"]],
    ["showError", "panel failed"],
  ]);
});

test("workflow page shell renderer callbacks resolve commands lazily", () => {
  const calls = [];
  let commands = {
    acceptConvergence: () => calls.push(["initialAcceptConvergence"]),
  };
  const callbacks = createWorkflowPanelRendererCallbacks({
    getCommands: () => commands,
    showError: () => {},
  });
  commands = {
    acceptConvergence: () => calls.push(["lateAcceptConvergence"]),
  };

  callbacks.onAcceptConvergence();

  assert.deepEqual(calls, [["lateAcceptConvergence"]]);
});

test("workflow page shell renderer callbacks route task selection through the data controller", () => {
  const calls = [];
  const callbacks = createWorkflowOverviewRendererCallbacks({
    getDataController: () => ({
      selectTask: (fileName) => calls.push(["selectTask", fileName]),
    }),
  });

  callbacks.onSelectTask("task-001.yaml");

  assert.deepEqual(calls, [["selectTask", "task-001.yaml"]]);
});

test("workflow page shell renderer callbacks route workflow section rendering through the data controller", () => {
  const calls = [];
  const callbacks = createWorkflowRecommendationRunRendererCallbacks({
    getDataController: () => ({
      renderWorkflowSections: (taskContextPackage) =>
        calls.push(["renderWorkflowSections", taskContextPackage]),
    }),
  });

  callbacks.renderWorkflowSections({ packageId: "task-context-package:001" });

  assert.deepEqual(calls, [
    ["renderWorkflowSections", { packageId: "task-context-package:001" }],
  ]);
});
