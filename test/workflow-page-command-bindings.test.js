import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageCommandBindings } from "../public/workflow-page-command-bindings.js";

class FakeButton {
  constructor() {
    this.dataset = {};
    this.listeners = new Map();
  }

  addEventListener(eventName, listener) {
    this.listeners.set(eventName, listener);
  }

  click() {
    return this.listeners.get("click")?.({ target: this });
  }

  change() {
    return this.listeners.get("change")?.({ target: this });
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

function createHarness() {
  const calls = [];
  const documentRef = new FakeDocument();
  const elements = {
    restartButton: new FakeButton(),
    refreshButton: new FakeButton(),
    seedStateFixturesButton: new FakeButton(),
    cleanupStateFixturesButton: new FakeButton(),
    runRecommendationButton: new FakeButton(),
    runWorkflowButton: new FakeButton(),
    cancelRecommendationButton: new FakeButton(),
    stageSwitchExecutionAdmission: new FakeButton(),
    stageSwitchIsolatedWorkspace: new FakeButton(),
    stageSwitchMainAgent: new FakeButton(),
    stageSwitchExecutionAgent: new FakeButton(),
    stageSwitchReviewAgent: new FakeButton(),
    stageSwitchConvergence: new FakeButton(),
    taskDraftDiscussButton: new FakeButton(),
    taskDraftFinalizeButton: new FakeButton(),
    taskDraftCreateButton: new FakeButton(),
    taskDraftInput: new FakeButton(),
    terminalStartButton: new FakeButton(),
    terminalCancelButton: new FakeButton(),
    terminalSendButton: new FakeButton(),
    terminalInput: new FakeButton(),
  };
  const commandActions = {
    refreshPage: async () => calls.push(["refreshPage"]),
    restartServer: async () => calls.push(["restartServer"]),
    seedStateFixtures: async () => calls.push(["seedStateFixtures"]),
    cleanupStateFixtures: async () => calls.push(["cleanupStateFixtures"]),
    createRecommendationRun: async (input) => calls.push(["createRecommendationRun", input]),
    createWorkflowRun: async () => calls.push(["createWorkflowRun"]),
    cancelRecommendationRun: async () => calls.push(["cancelRecommendationRun"]),
    updateStageSwitches: async () => calls.push(["updateStageSwitches"]),
    sendTaskDraftMessage: async () => calls.push(["sendTaskDraftMessage"]),
    finalizeTaskDraft: async () => calls.push(["finalizeTaskDraft"]),
    createTaskSourceFromDraft: async () => calls.push(["createTaskSourceFromDraft"]),
    startTerminalSession: async () => calls.push(["startTerminalSession"]),
    sendTerminalInput: async () => calls.push(["sendTerminalInput"]),
    cancelTerminalSession: async () => calls.push(["cancelTerminalSession"]),
    replanAutoMerge: async (actionButton) => calls.push(["replanAutoMerge", actionButton]),
  };
  const bindings = createWorkflowPageCommandBindings({
    elements,
    documentRef,
    showError: (error) => calls.push(["showError", error.message]),
    commandActions,
    resetRestartControlsFn: (targets) => calls.push(["resetRestartControls", targets]),
  });

  return {
    bindings,
    calls,
    commandActions,
    documentRef,
    elements,
  };
}

test("workflow page command bindings route page control events to command actions", async () => {
  const harness = createHarness();

  harness.bindings.bindPageControls();
  harness.elements.refreshButton.click();
  harness.elements.seedStateFixturesButton.click();
  harness.elements.cleanupStateFixturesButton.click();
  harness.elements.runRecommendationButton.click();
  harness.elements.runWorkflowButton.click();
  harness.elements.cancelRecommendationButton.click();
  harness.elements.stageSwitchExecutionAdmission.change();
  harness.elements.taskDraftDiscussButton.click();
  harness.elements.taskDraftFinalizeButton.click();
  harness.elements.taskDraftCreateButton.click();
  harness.elements.terminalStartButton.click();
  harness.elements.terminalSendButton.click();
  harness.elements.terminalCancelButton.click();
  await Promise.resolve();

  assert.deepEqual(harness.calls, [
    ["refreshPage"],
    ["seedStateFixtures"],
    ["cleanupStateFixtures"],
    ["createRecommendationRun", { mode: "probe" }],
    ["createWorkflowRun"],
    ["cancelRecommendationRun"],
    ["updateStageSwitches"],
    ["sendTaskDraftMessage"],
    ["finalizeTaskDraft"],
    ["createTaskSourceFromDraft"],
    ["startTerminalSession"],
    ["sendTerminalInput"],
    ["cancelTerminalSession"],
  ]);
  assert.equal(harness.documentRef.listeners.has("click"), true);
  assert.equal(harness.documentRef.listeners.has("pointerup"), true);
  assert.equal(harness.documentRef.listeners.has("keydown"), true);
});

test("workflow page command bindings reset restart controls when restart fails", async () => {
  const harness = createHarness();
  harness.commandActions.restartServer = async () => {
    harness.calls.push(["restartServer"]);
    throw new Error("restart failed");
  };
  const bindings = createWorkflowPageCommandBindings({
    elements: harness.elements,
    documentRef: harness.documentRef,
    showError: (error) => harness.calls.push(["showError", error.message]),
    commandActions: harness.commandActions,
    resetRestartControlsFn: (targets) => harness.calls.push(["resetRestartControls", targets]),
  });

  bindings.bindPageControls();
  harness.elements.restartButton.click();
  await Promise.resolve();

  assert.deepEqual(harness.calls, [
    ["restartServer"],
    [
      "resetRestartControls",
      {
        restartButton: harness.elements.restartButton,
        refreshButton: harness.elements.refreshButton,
      },
    ],
    ["showError", "restart failed"],
  ]);
});

test("workflow page command bindings dispatch supported document actions", async () => {
  const harness = createHarness();
  const actionButton = new FakeButton();
  actionButton.dataset.action = "replan-auto-merge";
  const event = {
    target: { closest: () => actionButton },
    type: "keydown",
    key: "Enter",
    preventDefaultCalled: false,
    preventDefault() {
      this.preventDefaultCalled = true;
    },
  };

  await harness.bindings.handleDocumentAction(event);

  assert.equal(event.preventDefaultCalled, true);
  assert.deepEqual(harness.calls, [["replanAutoMerge", actionButton]]);
});

test("workflow page command bindings ignore pending and unsupported document actions", async () => {
  const harness = createHarness();
  const actionButton = new FakeButton();
  actionButton.dataset.action = "replan-auto-merge";

  const pendingBindings = createWorkflowPageCommandBindings({
    elements: harness.elements,
    documentRef: harness.documentRef,
    showError: (error) => harness.calls.push(["showError", error.message]),
    commandActions: harness.commandActions,
    isActionPending: () => true,
  });
  await pendingBindings.handleDocumentAction({
    target: { closest: () => actionButton },
    type: "click",
    preventDefault() {
      harness.calls.push(["preventDefault"]);
    },
  });
  await harness.bindings.handleDocumentAction({
    target: { closest: () => actionButton },
    type: "keydown",
    key: "Escape",
    preventDefault() {
      harness.calls.push(["ignoredPreventDefault"]);
    },
  });

  assert.deepEqual(harness.calls, [["preventDefault"]]);
});
