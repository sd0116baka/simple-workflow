import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageFixtureCommands } from "../public/workflow-page-fixture-commands.js";

function createButton({ textContent = "" } = {}) {
  return {
    dataset: {},
    disabled: false,
    textContent,
  };
}

function createHarness({ selectedFileName = "task-001.yaml" } = {}) {
  const calls = [];
  const scheduled = [];
  let currentSelectedFileName = selectedFileName;
  const elements = {
    seedStateFixtureSelect: { value: "human-guided-execution" },
    seedStateFixturesButton: createButton({ textContent: "生成状态桩" }),
    cleanupStateFixturesButton: createButton({ textContent: "清理状态桩" }),
  };
  const workflowApi = {
    async seedStateFixtures(payload) {
      calls.push(["seedStateFixtures", payload]);
      return {
        tasks: [
          {
            sourcePath: "tasks/stub-human.yaml",
            currentWorkStage: "human-decision",
          },
        ],
      };
    },
    async cleanupStateFixtures() {
      calls.push(["cleanupStateFixtures"]);
      return { removedTaskFiles: 2 };
    },
  };
  const commands = createWorkflowPageFixtureCommands({
    workflowApi,
    getSelectedFileName: () => currentSelectedFileName,
    setSelectedFileName: (fileName) => {
      currentSelectedFileName = fileName;
      calls.push(["setSelectedFileName", fileName]);
    },
    setRecommendationRun: (run) => calls.push(["setRecommendationRun", run]),
    refreshPage: async () => calls.push(["refreshPage"]),
    elements,
    setTimeoutFn(callback, delay) {
      scheduled.push({ callback, delay });
    },
  });

  return {
    calls,
    commands,
    elements,
    getSelectedFileName: () => currentSelectedFileName,
    scheduled,
    workflowApi,
  };
}

test("workflow page fixture commands seed state fixtures and refresh the page", async () => {
  const harness = createHarness();

  const result = await harness.commands.seedStateFixtures();

  assert.equal(result.ok, true);
  assert.equal(harness.getSelectedFileName(), "stub-human.yaml");
  assert.equal(harness.elements.seedStateFixturesButton.disabled, true);
  assert.equal(
    harness.elements.seedStateFixturesButton.textContent,
    "已生成 human-guided-execution -> human-decision",
  );
  assert.equal(harness.scheduled[0].delay, 1500);
  harness.scheduled[0].callback();
  assert.equal(harness.elements.seedStateFixturesButton.disabled, false);
  assert.equal(harness.elements.seedStateFixturesButton.textContent, "生成状态桩");
  assert.deepEqual(harness.calls, [
    ["seedStateFixtures", { fixtureKey: "human-guided-execution" }],
    ["setSelectedFileName", "stub-human.yaml"],
    ["setRecommendationRun", null],
    ["refreshPage"],
  ]);
});

test("workflow page fixture commands cleanup fixtures and clear generated selection", async () => {
  const harness = createHarness({ selectedFileName: "stub-human.yaml" });

  const result = await harness.commands.cleanupStateFixtures();

  assert.equal(result.ok, true);
  assert.equal(harness.getSelectedFileName(), null);
  assert.equal(harness.elements.cleanupStateFixturesButton.disabled, true);
  assert.equal(harness.elements.cleanupStateFixturesButton.textContent, "已清理 2 个");
  assert.equal(harness.scheduled[0].delay, 1500);
  harness.scheduled[0].callback();
  assert.equal(harness.elements.cleanupStateFixturesButton.disabled, false);
  assert.equal(harness.elements.cleanupStateFixturesButton.textContent, "清理状态桩");
  assert.deepEqual(harness.calls, [
    ["cleanupStateFixtures"],
    ["setRecommendationRun", null],
    ["setSelectedFileName", null],
    ["refreshPage"],
  ]);
});

test("workflow page fixture commands reset seed feedback on API failure", async () => {
  const harness = createHarness();
  harness.workflowApi.seedStateFixtures = async () => {
    harness.calls.push(["seedStateFixtures"]);
    throw new Error("seed failed");
  };

  await assert.rejects(
    () => harness.commands.seedStateFixtures(),
    /seed failed/,
  );

  assert.equal(harness.elements.seedStateFixturesButton.disabled, false);
  assert.equal(harness.elements.seedStateFixturesButton.textContent, "生成状态桩");
  assert.deepEqual(harness.calls, [["seedStateFixtures"]]);
});

test("workflow page fixture commands skip absent fixture buttons", async () => {
  const calls = [];
  const commands = createWorkflowPageFixtureCommands({
    workflowApi: {
      async seedStateFixtures() {
        calls.push(["seedStateFixtures"]);
        return { tasks: [] };
      },
      async cleanupStateFixtures() {
        calls.push(["cleanupStateFixtures"]);
        return { removedTaskFiles: 0 };
      },
    },
    getSelectedFileName: () => null,
    setSelectedFileName: (fileName) => calls.push(["setSelectedFileName", fileName]),
    setRecommendationRun: (run) => calls.push(["setRecommendationRun", run]),
    refreshPage: async () => calls.push(["refreshPage"]),
    elements: {
      seedStateFixtureSelect: null,
      seedStateFixturesButton: null,
      cleanupStateFixturesButton: null,
    },
  });

  assert.deepEqual(await commands.seedStateFixtures(), { ok: false, skipped: true });
  assert.deepEqual(await commands.cleanupStateFixtures(), { ok: false, skipped: true });
  assert.deepEqual(calls, []);
});
