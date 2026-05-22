import { test } from "node:test";
import assert from "node:assert/strict";
import { beginActionFeedback } from "../public/workflow-action-feedback.js";
import { createWorkflowPageCommands } from "../public/workflow-page-commands.js";

class FakeButton {
  constructor() {
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.listeners = new Map();
    this.textContent = "";
  }

  addEventListener(eventName, listener) {
    this.listeners.set(eventName, listener);
  }

  click() {
    return this.listeners.get("click")?.({ target: this });
  }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(eventName, listener) {
    this.listeners.set(eventName, listener);
  }

  emit(eventName, event) {
    return this.listeners.get(eventName)?.(event);
  }
}

function createElements() {
  return {
    restartButton: new FakeButton(),
    refreshButton: new FakeButton(),
    seedStateFixturesButton: new FakeButton(),
    cleanupStateFixturesButton: new FakeButton(),
    runRecommendationButton: new FakeButton(),
    cancelRecommendationButton: new FakeButton(),
  };
}

function createPageCommandGroupStub(calls) {
  return {
    commandActions: {
      refreshPage: async () => calls.push(["refreshPage"]),
      restartServer: async () => calls.push(["restartServer"]),
      seedStateFixtures: async () => calls.push(["seedStateFixtures"]),
      cleanupStateFixtures: async () => calls.push(["cleanupStateFixtures"]),
      createRecommendationRun: async () => calls.push(["createRecommendationRun"]),
      cancelRecommendationRun: async () => calls.push(["cancelRecommendationRun"]),
      replanAutoMerge: async (button) => calls.push(["replanAutoMerge", button]),
    },
    pageCommands: {
      acceptConvergence: async (button) => calls.push(["acceptConvergence", button]),
      continueConvergenceWithGuidance: async (payload) =>
        calls.push(["continueConvergenceWithGuidance", payload]),
      cancelTask: async (button) => calls.push(["cancelTask", button]),
      replanAutoMerge: async (button) => calls.push(["pageReplanAutoMerge", button]),
      createRecommendationRun: async () => calls.push(["pageCreateRecommendationRun"]),
      cancelRecommendationRun: async () => calls.push(["pageCancelRecommendationRun"]),
      restartServer: async () => calls.push(["pageRestartServer"]),
      seedStateFixtures: async () => calls.push(["pageSeedStateFixtures"]),
      cleanupStateFixtures: async () => calls.push(["pageCleanupStateFixtures"]),
      refreshPage: async () => calls.push(["pageRefreshPage"]),
    },
  };
}

test("workflow page commands expose command group page commands and binding methods", async () => {
  const calls = [];
  const elements = createElements();
  const commandGroups = createPageCommandGroupStub(calls);
  const commandBindings = {
    bindPageControls: () => calls.push(["bindPageControls"]),
    handleDocumentAction: (event) => calls.push(["handleDocumentAction", event.type]),
  };
  const commands = createWorkflowPageCommands({
    workflowApi: { id: "workflow-api" },
    activeTaskContextPackage: () => ({ packageId: "package:001" }),
    setRecommendationRun: () => {},
    renderRecommendationRun: () => {},
    loadTasks: async () => {},
    loadRecommendationRun: async () => {},
    getSelectedFileName: () => "task-001.yaml",
    setSelectedFileName: () => {},
    elements,
    showError: (error) => calls.push(["showError", error.message]),
    documentRef: new FakeDocument(),
    createCommandGroups(options) {
      calls.push(["createCommandGroups", options]);
      return commandGroups;
    },
    createCommandBindings(options) {
      calls.push(["createCommandBindings", options]);
      return commandBindings;
    },
  });

  await commands.acceptConvergence("accept-button");
  await commands.continueConvergenceWithGuidance({ guidance: "继续" });
  await commands.cancelTask("cancel-button");
  await commands.replanAutoMerge("replan-button");
  await commands.createRecommendationRun();
  await commands.cancelRecommendationRun();
  await commands.restartServer();
  await commands.seedStateFixtures();
  await commands.cleanupStateFixtures();
  await commands.refreshPage();
  commands.bindPageControls();
  commands.handleDocumentAction({ type: "click" });

  assert.equal(calls[0][0], "createCommandGroups");
  assert.equal(calls[1][0], "createCommandBindings");
  assert.equal(calls[1][1].commandActions, commandGroups.commandActions);
  assert.deepEqual(calls.slice(2), [
    ["acceptConvergence", "accept-button"],
    ["continueConvergenceWithGuidance", { guidance: "继续" }],
    ["cancelTask", "cancel-button"],
    ["pageReplanAutoMerge", "replan-button"],
    ["pageCreateRecommendationRun"],
    ["pageCancelRecommendationRun"],
    ["pageRestartServer"],
    ["pageSeedStateFixtures"],
    ["pageCleanupStateFixtures"],
    ["pageRefreshPage"],
    ["bindPageControls"],
    ["handleDocumentAction", "click"],
  ]);
});

test("workflow page commands bind page controls through command group action map", async () => {
  const calls = [];
  const elements = createElements();
  const documentRef = new FakeDocument();
  const commands = createWorkflowPageCommands({
    workflowApi: {},
    activeTaskContextPackage: () => null,
    setRecommendationRun: () => {},
    renderRecommendationRun: () => {},
    loadTasks: async () => {},
    loadRecommendationRun: async () => {},
    getSelectedFileName: () => null,
    setSelectedFileName: () => {},
    elements,
    showError: (error) => calls.push(["showError", error.message]),
    documentRef,
    createCommandGroups() {
      return createPageCommandGroupStub(calls);
    },
  });

  commands.bindPageControls();
  await elements.restartButton.click();
  await elements.refreshButton.click();
  await elements.seedStateFixturesButton.click();
  await elements.cleanupStateFixturesButton.click();
  await elements.runRecommendationButton.click();
  await elements.cancelRecommendationButton.click();

  const actionButton = new FakeButton();
  actionButton.dataset.action = "replan-auto-merge";
  await documentRef.emit("click", {
    target: { closest: () => actionButton },
    type: "click",
    preventDefault() {},
  });

  const pendingButton = new FakeButton();
  pendingButton.dataset.action = "replan-auto-merge";
  beginActionFeedback(pendingButton, { pending: true });
  await documentRef.emit("click", {
    target: { closest: () => pendingButton },
    type: "click",
    preventDefault() {},
  });

  assert.equal(documentRef.listeners.has("click"), true);
  assert.equal(documentRef.listeners.has("pointerup"), true);
  assert.equal(documentRef.listeners.has("keydown"), true);
  assert.deepEqual(calls, [
    ["restartServer"],
    ["refreshPage"],
    ["seedStateFixtures"],
    ["cleanupStateFixtures"],
    ["createRecommendationRun"],
    ["cancelRecommendationRun"],
    ["replanAutoMerge", actionButton],
  ]);
});
