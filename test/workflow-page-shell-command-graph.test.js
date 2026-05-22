import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageShellCommandGraph } from "../public/workflow-page-shell-command-graph.js";

test("workflow page shell command graph projects data controller commands and command targets", () => {
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
  const workflowPageDataController = {
    activeTaskContextPackage: () => ({ packageId: "package:001" }),
    getSelectedFileName: () => "task-001.yaml",
    loadRecommendationRun: () => calls.push(["loadRecommendationRun"]),
    loadTasks: () => calls.push(["loadTasks"]),
    renderRecommendationRun: () => calls.push(["renderRecommendationRun"]),
    setRecommendationRun: (recommendationRun) =>
      calls.push(["setRecommendationRun", recommendationRun]),
    setSelectedFileName: (fileName) => calls.push(["setSelectedFileName", fileName]),
  };
  const commands = { bindPageControls: () => calls.push(["bindPageControls"]) };

  const commandGraph = createWorkflowPageShellCommandGraph({
    workflowApi,
    elements,
    workflowPageDataController,
    showError,
    createCommands(options) {
      calls.push(["createCommands", options]);
      return commands;
    },
  });

  assert.equal(commandGraph.workflowPageCommands, commands);
  const commandOptions = calls[0][1];
  assert.equal(commandOptions.workflowApi, workflowApi);
  assert.equal(commandOptions.showError, showError);
  assert.equal(commandOptions.elements.restartButton, elements.restartButton);
  assert.equal(commandOptions.elements.autoMergeStatus, elements.autoMergeStatus);
  assert.deepEqual(commandOptions.activeTaskContextPackage(), { packageId: "package:001" });
  assert.equal(commandOptions.getSelectedFileName(), "task-001.yaml");

  commandOptions.setSelectedFileName("task-002.yaml");
  commandOptions.setRecommendationRun({ id: "run:001" });
  commandOptions.renderRecommendationRun();
  commandOptions.loadTasks();
  commandOptions.loadRecommendationRun();

  assert.deepEqual(calls.slice(1), [
    ["setSelectedFileName", "task-002.yaml"],
    ["setRecommendationRun", { id: "run:001" }],
    ["renderRecommendationRun"],
    ["loadTasks"],
    ["loadRecommendationRun"],
  ]);
});
