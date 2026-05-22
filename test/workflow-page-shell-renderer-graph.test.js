import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageShellRendererGraph } from "../public/workflow-page-shell-renderer-graph.js";

function createHarness() {
  const calls = [];
  let commands = {
    acceptConvergence: (...args) => calls.push(["acceptConvergence", args]),
    cancelTask: (...args) => calls.push(["cancelTask", args]),
    continueConvergenceWithGuidance: (...args) =>
      calls.push(["continueConvergenceWithGuidance", args]),
  };
  const dataController = {
    renderWorkflowSections: (taskContextPackage) =>
      calls.push(["renderWorkflowSections", taskContextPackage]),
    selectTask: (fileName) => calls.push(["selectTask", fileName]),
  };
  const graph = createWorkflowPageShellRendererGraph({
    getCommands: () => commands,
    getDataController: () => dataController,
    showError: (error) => calls.push(["showError", error.message]),
    createPanelRenderers(options) {
      calls.push(["createPanelRenderers", options]);
      return { type: "panel-renderers" };
    },
    createOverviewRenderers(options) {
      calls.push(["createOverviewRenderers", options]);
      return { type: "overview-renderers" };
    },
    createRecommendationRunRenderer(options) {
      calls.push(["createRecommendationRunRenderer", options]);
      return { type: "recommendation-renderer" };
    },
    createSectionRenderer(options) {
      calls.push(["createSectionRenderer", options]);
      return { type: "section-renderer" };
    },
    createTerminalRenderer() {
      calls.push(["createTerminalRenderer"]);
      return { type: "terminal-renderer" };
    },
  });

  return {
    calls,
    graph,
    replaceCommands(nextCommands) {
      commands = nextCommands;
    },
  };
}

test("workflow page shell renderer graph creates renderer modules in dependency order", () => {
  const { calls, graph } = createHarness();

  assert.equal(graph.workflowPanelRenderers.type, "panel-renderers");
  assert.equal(graph.workflowOverviewRenderers.type, "overview-renderers");
  assert.equal(graph.workflowSectionRenderer.type, "section-renderer");
  assert.equal(graph.workflowRecommendationRunRenderer.type, "recommendation-renderer");
  assert.equal(graph.workflowTerminalRenderer.type, "terminal-renderer");
  assert.deepEqual(calls.map((call) => call[0]), [
    "createPanelRenderers",
    "createOverviewRenderers",
    "createSectionRenderer",
    "createRecommendationRunRenderer",
    "createTerminalRenderer",
  ]);

  const sectionOptions = calls.find((call) => call[0] === "createSectionRenderer")[1];
  assert.equal(sectionOptions.workflowPanelRenderers, graph.workflowPanelRenderers);
  assert.equal(sectionOptions.workflowOverviewRenderers, graph.workflowOverviewRenderers);

  const recommendationOptions = calls.find(
    (call) => call[0] === "createRecommendationRunRenderer",
  )[1];
  assert.equal(recommendationOptions.workflowPanelRenderers, graph.workflowPanelRenderers);
  assert.equal(recommendationOptions.workflowOverviewRenderers, graph.workflowOverviewRenderers);
});

test("workflow page shell renderer graph routes renderer callbacks lazily", () => {
  const harness = createHarness();
  const panelOptions = harness.calls.find((call) => call[0] === "createPanelRenderers")[1];
  const overviewOptions = harness.calls.find((call) => call[0] === "createOverviewRenderers")[1];
  const recommendationOptions = harness.calls.find(
    (call) => call[0] === "createRecommendationRunRenderer",
  )[1];

  panelOptions.onAcceptConvergence("button");
  panelOptions.onContinueConvergenceWithGuidance({ guidance: "继续" });
  panelOptions.onCancelTask("cancel-button");
  panelOptions.showError(new Error("panel failed"));
  overviewOptions.onSelectTask("task-002.yaml");
  recommendationOptions.renderWorkflowSections({ packageId: "package:001" });

  assert.deepEqual(harness.calls.slice(-6), [
    ["acceptConvergence", ["button"]],
    ["continueConvergenceWithGuidance", [{ guidance: "继续" }]],
    ["cancelTask", ["cancel-button"]],
    ["showError", "panel failed"],
    ["selectTask", "task-002.yaml"],
    ["renderWorkflowSections", { packageId: "package:001" }],
  ]);
});

test("workflow page shell renderer graph resolves command callbacks after command creation", () => {
  const harness = createHarness();
  const panelOptions = harness.calls.find((call) => call[0] === "createPanelRenderers")[1];
  harness.replaceCommands({
    acceptConvergence: () => harness.calls.push(["lateAcceptConvergence"]),
  });

  panelOptions.onAcceptConvergence();

  assert.deepEqual(harness.calls.at(-1), ["lateAcceptConvergence"]);
});
