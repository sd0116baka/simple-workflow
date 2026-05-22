import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageShellModuleGraph } from "../public/workflow-page-shell-module-graph.js";

function createHarness() {
  const calls = [];
  const elements = {
    restartButton: "restartButton",
    refreshButton: "refreshButton",
    seedStateFixtureSelect: "seedStateFixtureSelect",
    seedStateFixturesButton: "seedStateFixturesButton",
    cleanupStateFixturesButton: "cleanupStateFixturesButton",
    runRecommendationButton: "runRecommendationButton",
    cancelRecommendationButton: "cancelRecommendationButton",
    recommendationStatus: "recommendationStatus",
    recommendationResult: "recommendationResult",
    humanDecisionStatus: "humanDecisionStatus",
    autoMergeStatus: "autoMergeStatus",
  };
  const workflowApi = { id: "workflow-api" };
  const showError = (error) => calls.push(["showError", error.message]);
  const dataController = {
    activeTaskContextPackage: () => {
      calls.push(["activeTaskContextPackage"]);
      return { packageId: "task-context-package:tasks/task-001.yaml" };
    },
    getSelectedFileName: () => "task-001.yaml",
    loadRecommendationRun: () => calls.push(["loadRecommendationRun"]),
    loadTasks: () => calls.push(["loadTasks"]),
    renderRecommendationRun: () => calls.push(["renderRecommendationRun"]),
    renderWorkflowSections: (taskContextPackage) =>
      calls.push(["renderWorkflowSections", taskContextPackage]),
    selectTask: (fileName) => calls.push(["selectTask", fileName]),
    setRecommendationRun: (recommendationRun, options) =>
      calls.push(["setRecommendationRun", recommendationRun, options]),
    setSelectedFileName: (fileName) => calls.push(["setSelectedFileName", fileName]),
  };
  const commands = {
    bindPageControls: () => calls.push(["bindPageControls"]),
  };
  const commandGraph = {
    workflowPageCommands: commands,
  };
  const rendererGraph = {
    workflowOverviewRenderers: { type: "overview-renderers" },
    workflowPanelRenderers: { type: "panel-renderers" },
    workflowRecommendationRunRenderer: { type: "recommendation-renderer" },
    workflowSectionRenderer: { type: "section-renderer" },
    workflowTerminalRenderer: { type: "terminal-renderer" },
  };
  const graph = createWorkflowPageShellModuleGraph({
    workflowApi,
    elements,
    showError,
    createCommandGraph(options) {
      calls.push(["createCommandGraph", options]);
      return commandGraph;
    },
    createRendererGraph(options) {
      calls.push(["createRendererGraph", options]);
      return rendererGraph;
    },
    createDataController(options) {
      calls.push(["createDataController", options]);
      return dataController;
    },
  });

  return {
    calls,
    commandGraph,
    commands,
    dataController,
    elements,
    graph,
    rendererGraph,
    showError,
    workflowApi,
  };
}

test("workflow page shell module graph creates renderer, controller, and command modules", () => {
  const harness = createHarness();

  assert.equal(harness.graph.workflowPageCommands, harness.commands);
  assert.equal(harness.graph.workflowPageDataController, harness.dataController);
  assert.equal(harness.graph.workflowPanelRenderers, harness.rendererGraph.workflowPanelRenderers);
  assert.equal(harness.graph.workflowOverviewRenderers, harness.rendererGraph.workflowOverviewRenderers);
  assert.equal(harness.graph.workflowSectionRenderer, harness.rendererGraph.workflowSectionRenderer);
  assert.equal(harness.graph.workflowTerminalRenderer, harness.rendererGraph.workflowTerminalRenderer);
  assert.equal(
    harness.graph.workflowRecommendationRunRenderer,
    harness.rendererGraph.workflowRecommendationRunRenderer,
  );
  assert.deepEqual(harness.calls.map((call) => call[0]), [
    "createRendererGraph",
    "createDataController",
    "createCommandGraph",
  ]);

  const rendererGraphOptions = harness.calls.find(
    (call) => call[0] === "createRendererGraph",
  )[1];
  assert.equal(rendererGraphOptions.showError, harness.showError);
  assert.equal(rendererGraphOptions.getCommands(), harness.commands);
  assert.equal(rendererGraphOptions.getDataController(), harness.dataController);

  const dataControllerOptions = harness.calls.find(
    (call) => call[0] === "createDataController",
  )[1];
  assert.equal(dataControllerOptions.workflowApi, harness.workflowApi);
  assert.equal(dataControllerOptions.workflowOverviewRenderers.type, "overview-renderers");
  assert.equal(dataControllerOptions.workflowSectionRenderer.type, "section-renderer");
  assert.equal(dataControllerOptions.workflowRecommendationRunRenderer.type, "recommendation-renderer");
  assert.equal(dataControllerOptions.workflowTerminalRenderer.type, "terminal-renderer");
  assert.equal(dataControllerOptions.elements, harness.elements);

  const commandGraphOptions = harness.calls.find((call) => call[0] === "createCommandGraph")[1];
  assert.equal(commandGraphOptions.workflowApi, harness.workflowApi);
  assert.equal(commandGraphOptions.elements, harness.elements);
  assert.equal(commandGraphOptions.showError, harness.showError);
  assert.equal(commandGraphOptions.workflowPageDataController, harness.dataController);
});
