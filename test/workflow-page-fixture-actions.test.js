import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanupStateFixturesAction,
  seedStateFixturesAction,
} from "../public/workflow-page-fixture-actions.js";

class FakeButton {
  constructor({ textContent = "", value = "" } = {}) {
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.textContent = textContent;
    this.value = value;
  }
}

function createHarness({ selectedFileName = "task-001.yaml" } = {}) {
  const calls = [];
  const scheduled = [];
  let currentSelectedFileName = selectedFileName;
  return {
    calls,
    scheduled,
    getSelectedFileName: () => currentSelectedFileName,
    setSelectedFileName: (nextSelectedFileName) => {
      currentSelectedFileName = nextSelectedFileName;
      calls.push(["setSelectedFileName", nextSelectedFileName]);
    },
    setRecommendationRun: (run) => calls.push(["setRecommendationRun", run]),
    refreshPage: async () => calls.push(["refreshPage"]),
    setTimeoutFn: (callback, delay) => {
      scheduled.push({ callback, delay });
    },
  };
}

test("seed state fixtures action updates selection, clears recommendation run, refreshes, and resets feedback", async () => {
  const harness = createHarness({ selectedFileName: "stub-old.yaml" });
  const seedStateFixturesButton = new FakeButton({ textContent: "生成状态桩" });
  const workflowApi = {
    async seedStateFixtures(payload) {
      harness.calls.push(["seedStateFixtures", payload]);
      return {
        tasks: [
          {
            sourcePath: "tasks/stub-human.yaml",
            currentWorkStage: "human-decision",
          },
        ],
      };
    },
  };

  const result = await seedStateFixturesAction({
    workflowApi,
    seedStateFixtureSelect: { value: "task-pool" },
    seedStateFixturesButton,
    getSelectedFileName: harness.getSelectedFileName,
    setSelectedFileName: harness.setSelectedFileName,
    setRecommendationRun: harness.setRecommendationRun,
    refreshPage: harness.refreshPage,
    setTimeoutFn: harness.setTimeoutFn,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls, [
    ["seedStateFixtures", { fixtureKey: "task-pool" }],
    ["setSelectedFileName", "stub-human.yaml"],
    ["setRecommendationRun", null],
    ["refreshPage"],
  ]);
  assert.equal(seedStateFixturesButton.disabled, true);
  assert.equal(seedStateFixturesButton.textContent, "已生成 task-pool -> human-decision");
  assert.equal(harness.scheduled[0].delay, 1500);
  harness.scheduled[0].callback();
  assert.equal(seedStateFixturesButton.disabled, false);
  assert.equal(seedStateFixturesButton.textContent, "生成状态桩");
});

test("seed state fixtures action restores feedback when API fails", async () => {
  const harness = createHarness();
  const seedStateFixturesButton = new FakeButton({ textContent: "生成状态桩" });

  await assert.rejects(
    () => seedStateFixturesAction({
      workflowApi: {
        async seedStateFixtures() {
          throw new Error("fixture failed");
        },
      },
      seedStateFixturesButton,
      getSelectedFileName: harness.getSelectedFileName,
      setSelectedFileName: harness.setSelectedFileName,
      setRecommendationRun: harness.setRecommendationRun,
      refreshPage: harness.refreshPage,
      setTimeoutFn: harness.setTimeoutFn,
    }),
    /fixture failed/,
  );

  assert.equal(seedStateFixturesButton.disabled, false);
  assert.equal(seedStateFixturesButton.textContent, "生成状态桩");
  assert.deepEqual(harness.calls, []);
});

test("cleanup state fixtures action clears recommendation run, updates selection, refreshes, and resets feedback", async () => {
  const harness = createHarness({ selectedFileName: "stub-old.yaml" });
  const cleanupStateFixturesButton = new FakeButton({ textContent: "清理状态桩" });
  const workflowApi = {
    async cleanupStateFixtures() {
      harness.calls.push(["cleanupStateFixtures"]);
      return { removedTaskFiles: 2 };
    },
  };

  const result = await cleanupStateFixturesAction({
    workflowApi,
    cleanupStateFixturesButton,
    getSelectedFileName: harness.getSelectedFileName,
    setSelectedFileName: harness.setSelectedFileName,
    setRecommendationRun: harness.setRecommendationRun,
    refreshPage: harness.refreshPage,
    setTimeoutFn: harness.setTimeoutFn,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(harness.calls, [
    ["cleanupStateFixtures"],
    ["setRecommendationRun", null],
    ["setSelectedFileName", null],
    ["refreshPage"],
  ]);
  assert.equal(cleanupStateFixturesButton.disabled, true);
  assert.equal(cleanupStateFixturesButton.textContent, "已清理 2 个");
  assert.equal(harness.scheduled[0].delay, 1500);
  harness.scheduled[0].callback();
  assert.equal(cleanupStateFixturesButton.disabled, false);
  assert.equal(cleanupStateFixturesButton.textContent, "清理状态桩");
});

test("fixture actions skip when optional fixture buttons are missing", async () => {
  assert.deepEqual(await seedStateFixturesAction(), { ok: false, skipped: true });
  assert.deepEqual(await cleanupStateFixturesAction(), { ok: false, skipped: true });
});
