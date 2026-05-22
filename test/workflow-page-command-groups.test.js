import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageCommandGroups } from "../public/workflow-page-command-groups.js";

test("workflow page command groups wire page status, command groups, and public page commands", async () => {
  const calls = [];
  const elements = { id: "elements" };
  const workflowApi = { id: "workflow-api" };
  const pageStatus = { id: "page-status" };
  const sleepFn = async () => {};
  const setTimeoutFn = () => {};
  const activeTaskContextPackage = () => ({ packageId: "package:001" });
  const setRecommendationRun = () => calls.push(["setRecommendationRun"]);
  const renderRecommendationRun = () => calls.push(["renderRecommendationRun"]);
  const loadTasks = async () => calls.push(["loadTasks"]);
  const loadRecommendationRun = async () => calls.push(["loadRecommendationRun"]);
  const getSelectedFileName = () => "task-001.yaml";
  const setSelectedFileName = () => calls.push(["setSelectedFileName"]);
  const startTerminalSession = async () => calls.push(["startTerminalSession"]);
  const sendTerminalInput = async () => calls.push(["sendTerminalInput"]);
  const cancelTerminalSession = async () => calls.push(["cancelTerminalSession"]);

  const groups = createWorkflowPageCommandGroups({
    workflowApi,
    activeTaskContextPackage,
    setRecommendationRun,
    renderRecommendationRun,
    loadTasks,
    loadRecommendationRun,
    getSelectedFileName,
    setSelectedFileName,
    startTerminalSession,
    sendTerminalInput,
    cancelTerminalSession,
    elements,
    sleepFn,
    setTimeoutFn,
    createPageStatus(receivedElements) {
      calls.push(["createPageStatus", receivedElements]);
      return pageStatus;
    },
    createManualActionCommands(options) {
      calls.push(["createManualActionCommands", options]);
      return {
        acceptConvergence: async () => calls.push(["acceptConvergence"]),
        continueConvergenceWithGuidance: async () =>
          calls.push(["continueConvergenceWithGuidance"]),
        cancelTask: async () => calls.push(["cancelTask"]),
      };
    },
    createAutoMergeReplanCommand(options) {
      calls.push(["createAutoMergeReplanCommand", options]);
      return {
        replanAutoMerge: async () => calls.push(["replanAutoMerge"]),
      };
    },
    createRecommendationRunCommands(options) {
      calls.push(["createRecommendationRunCommands", options]);
      return {
        createRecommendationRun: async () => calls.push(["createRecommendationRun"]),
        cancelRecommendationRun: async () => calls.push(["cancelRecommendationRun"]),
      };
    },
    createFixtureCommands(options) {
      calls.push(["createFixtureCommands", options]);
      return {
        seedStateFixtures: async () => calls.push(["seedStateFixtures"]),
        cleanupStateFixtures: async () => calls.push(["cleanupStateFixtures"]),
      };
    },
    createRestartCommand(options) {
      calls.push(["createRestartCommand", options]);
      return {
        restartServer: async () => calls.push(["restartServer"]),
      };
    },
    createCommandSurface(options) {
      calls.push(["createCommandSurface", options]);
      return {
        commandActions: {
          refreshPage: options.refreshPage,
          restartServer: options.restartCommand.restartServer,
          seedStateFixtures: options.fixtureCommands.seedStateFixtures,
          cleanupStateFixtures: options.fixtureCommands.cleanupStateFixtures,
          createRecommendationRun: options.recommendationRunCommands.createRecommendationRun,
          cancelRecommendationRun: options.recommendationRunCommands.cancelRecommendationRun,
          startTerminalSession: options.terminalCommands.startTerminalSession,
          sendTerminalInput: options.terminalCommands.sendTerminalInput,
          cancelTerminalSession: options.terminalCommands.cancelTerminalSession,
          replanAutoMerge: options.autoMergeReplanCommand.replanAutoMerge,
        },
        pageCommands: {
          refreshPage: options.refreshPage,
          acceptConvergence: options.manualActionCommands.acceptConvergence,
          continueConvergenceWithGuidance:
            options.manualActionCommands.continueConvergenceWithGuidance,
          replanAutoMerge: options.autoMergeReplanCommand.replanAutoMerge,
        },
      };
    },
  });

  await groups.pageCommands.acceptConvergence();
  await groups.pageCommands.continueConvergenceWithGuidance();
  await groups.pageCommands.refreshPage();

  await groups.commandActions.replanAutoMerge();
  await groups.commandActions.createRecommendationRun();
  await groups.commandActions.cancelRecommendationRun();
  await groups.commandActions.startTerminalSession();
  await groups.commandActions.sendTerminalInput();
  await groups.commandActions.cancelTerminalSession();
  await groups.commandActions.seedStateFixtures();
  await groups.commandActions.cleanupStateFixtures();
  await groups.commandActions.restartServer();
  await groups.commandActions.refreshPage();

  assert.deepEqual(calls.map((call) => call[0]).slice(0, 7), [
    "createPageStatus",
    "createManualActionCommands",
    "createAutoMergeReplanCommand",
    "createRecommendationRunCommands",
    "createFixtureCommands",
    "createRestartCommand",
    "createCommandSurface",
  ]);

  const manualOptions = calls[1][1];
  assert.equal(manualOptions.workflowApi, workflowApi);
  assert.equal(manualOptions.activeTaskContextPackage, activeTaskContextPackage);
  assert.equal(manualOptions.pageStatus, pageStatus);
  assert.equal(manualOptions.setRecommendationRun, setRecommendationRun);
  assert.equal(manualOptions.renderRecommendationRun, renderRecommendationRun);
  assert.equal(manualOptions.loadTasks, loadTasks);

  const autoMergeOptions = calls[2][1];
  assert.equal(autoMergeOptions.workflowApi, workflowApi);
  assert.equal(autoMergeOptions.activeTaskContextPackage, activeTaskContextPackage);
  assert.equal(autoMergeOptions.pageStatus, pageStatus);
  assert.equal(autoMergeOptions.setRecommendationRun, setRecommendationRun);
  assert.equal(autoMergeOptions.renderRecommendationRun, renderRecommendationRun);
  assert.equal(autoMergeOptions.loadTasks, loadTasks);

  const recommendationOptions = calls[3][1];
  assert.equal(recommendationOptions.workflowApi, workflowApi);
  assert.equal(recommendationOptions.pageStatus, pageStatus);
  assert.equal(recommendationOptions.elements, elements);

  const fixtureOptions = calls[4][1];
  assert.equal(fixtureOptions.getSelectedFileName, getSelectedFileName);
  assert.equal(fixtureOptions.setSelectedFileName, setSelectedFileName);
  assert.equal(fixtureOptions.setTimeoutFn, setTimeoutFn);

  const restartOptions = calls[5][1];
  assert.equal(restartOptions.refreshPage, groups.pageCommands.refreshPage);
  assert.equal(restartOptions.sleepFn, sleepFn);

  const surfaceOptions = calls[6][1];
  assert.equal(surfaceOptions.refreshPage, groups.pageCommands.refreshPage);
  assert.equal(
    surfaceOptions.autoMergeReplanCommand.replanAutoMerge,
    groups.commandActions.replanAutoMerge,
  );
  assert.equal(
    surfaceOptions.recommendationRunCommands.createRecommendationRun,
    groups.commandActions.createRecommendationRun,
  );
  assert.equal(
    surfaceOptions.fixtureCommands.seedStateFixtures,
    groups.commandActions.seedStateFixtures,
  );
  assert.equal(surfaceOptions.restartCommand.restartServer, groups.commandActions.restartServer);
  assert.equal(surfaceOptions.terminalCommands.startTerminalSession, startTerminalSession);
  assert.equal(surfaceOptions.terminalCommands.sendTerminalInput, sendTerminalInput);
  assert.equal(surfaceOptions.terminalCommands.cancelTerminalSession, cancelTerminalSession);

  assert.deepEqual(calls.slice(7), [
    ["acceptConvergence"],
    ["continueConvergenceWithGuidance"],
    ["loadTasks"],
    ["loadRecommendationRun"],
    ["replanAutoMerge"],
    ["createRecommendationRun"],
    ["cancelRecommendationRun"],
    ["startTerminalSession"],
    ["sendTerminalInput"],
    ["cancelTerminalSession"],
    ["seedStateFixtures"],
    ["cleanupStateFixtures"],
    ["restartServer"],
    ["loadTasks"],
    ["loadRecommendationRun"],
  ]);
});
