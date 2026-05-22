import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageCommandSurface } from "../public/workflow-page-command-surface.js";

test("workflow page command surface exposes page commands and document actions", async () => {
  const calls = [];
  const refreshPage = async () => calls.push(["refreshPage"]);
  const manualActionCommands = {
    acceptConvergence: async () => calls.push(["acceptConvergence"]),
    continueConvergenceWithGuidance: async () =>
      calls.push(["continueConvergenceWithGuidance"]),
    cancelTask: async () => calls.push(["cancelTask"]),
  };
  const autoMergeReplanCommand = {
    replanAutoMerge: async () => calls.push(["replanAutoMerge"]),
  };
  const recommendationRunCommands = {
    createRecommendationRun: async () => calls.push(["createRecommendationRun"]),
    createWorkflowRun: async () => calls.push(["createWorkflowRun"]),
    cancelRecommendationRun: async () => calls.push(["cancelRecommendationRun"]),
  };
  const fixtureCommands = {
    seedStateFixtures: async () => calls.push(["seedStateFixtures"]),
    cleanupStateFixtures: async () => calls.push(["cleanupStateFixtures"]),
  };
  const restartCommand = {
    restartServer: async () => calls.push(["restartServer"]),
  };
  const terminalCommands = {
    startTerminalSession: async () => calls.push(["startTerminalSession"]),
    sendTerminalInput: async () => calls.push(["sendTerminalInput"]),
    cancelTerminalSession: async () => calls.push(["cancelTerminalSession"]),
  };

  const surface = createWorkflowPageCommandSurface({
    autoMergeReplanCommand,
    fixtureCommands,
    manualActionCommands,
    recommendationRunCommands,
    refreshPage,
    restartCommand,
    terminalCommands,
  });

  await surface.pageCommands.acceptConvergence();
  await surface.pageCommands.continueConvergenceWithGuidance();
  await surface.pageCommands.cancelTask();
  await surface.pageCommands.replanAutoMerge();
  await surface.pageCommands.createRecommendationRun();
  await surface.pageCommands.createWorkflowRun();
  await surface.pageCommands.cancelRecommendationRun();
  await surface.pageCommands.startTerminalSession();
  await surface.pageCommands.sendTerminalInput();
  await surface.pageCommands.cancelTerminalSession();
  await surface.pageCommands.seedStateFixtures();
  await surface.pageCommands.cleanupStateFixtures();
  await surface.pageCommands.restartServer();
  await surface.pageCommands.refreshPage();
  await surface.commandActions.replanAutoMerge();
  await surface.commandActions.createRecommendationRun();
  await surface.commandActions.createWorkflowRun();
  await surface.commandActions.cancelRecommendationRun();
  await surface.commandActions.startTerminalSession();
  await surface.commandActions.sendTerminalInput();
  await surface.commandActions.cancelTerminalSession();
  await surface.commandActions.seedStateFixtures();
  await surface.commandActions.cleanupStateFixtures();
  await surface.commandActions.restartServer();
  await surface.commandActions.refreshPage();

  assert.deepEqual(calls, [
    ["acceptConvergence"],
    ["continueConvergenceWithGuidance"],
    ["cancelTask"],
    ["replanAutoMerge"],
    ["createRecommendationRun"],
    ["createWorkflowRun"],
    ["cancelRecommendationRun"],
    ["startTerminalSession"],
    ["sendTerminalInput"],
    ["cancelTerminalSession"],
    ["seedStateFixtures"],
    ["cleanupStateFixtures"],
    ["restartServer"],
    ["refreshPage"],
    ["replanAutoMerge"],
    ["createRecommendationRun"],
    ["createWorkflowRun"],
    ["cancelRecommendationRun"],
    ["startTerminalSession"],
    ["sendTerminalInput"],
    ["cancelTerminalSession"],
    ["seedStateFixtures"],
    ["cleanupStateFixtures"],
    ["restartServer"],
    ["refreshPage"],
  ]);
});
