import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowServiceRuntime } from "../src/workflow/workflow-service-runtime.js";

function createRuntimeHarness() {
  const calls = [];
  const latestRun = { id: "run-1", status: "completed" };
  const listener = () => {};
  const unsubscribe = () => {};
  const runtime = createWorkflowServiceRuntime({
    workflowReadModelService: {
      listTasks() {
        calls.push(["listTasks"]);
        return [{ fileName: "task.yaml" }];
      },
      async listTaskPool() {
        calls.push(["listTaskPool"]);
        return { taskContextPackages: [] };
      },
      async getStartupCheck() {
        calls.push(["getStartupCheck"]);
        return { ok: true };
      },
    },
    workflowTestFixtureService: {
      async seedTestStateFixtures(input) {
        calls.push(["seedTestStateFixtures", input]);
        return { seeded: true };
      },
      async cleanupTestStateFixtures() {
        calls.push(["cleanupTestStateFixtures"]);
        return { cleaned: true };
      },
    },
    recommendationRunLifecycle: {
      async createRecommendationRun() {
        calls.push(["createRecommendationRun"]);
        return { id: "run-2" };
      },
      cancelRecommendationRun() {
        calls.push(["cancelRecommendationRun"]);
        return { cancelled: true };
      },
      updateRecommendationRunStageSwitches(input) {
        calls.push(["updateRecommendationRunStageSwitches", input]);
        return { updated: true };
      },
      getLatestRecommendationRun() {
        calls.push(["getLatestRecommendationRun"]);
        return latestRun;
      },
    },
    manualWorkflowActionService: {
      async acceptConvergenceSuccess(input) {
        calls.push(["acceptConvergenceSuccess", input]);
        return { accepted: true };
      },
      async replanAutoMerge(input) {
        calls.push(["replanAutoMerge", input]);
        return { planned: true };
      },
      async continueConvergenceWithGuidance(input) {
        calls.push(["continueConvergenceWithGuidance", input]);
        return { continued: true };
      },
      async cancelTask(input) {
        calls.push(["cancelTask", input]);
        return { cancelled: true };
      },
    },
    taskSourceDraftAssistant: {
      async discussTaskSourceDraft(input) {
        calls.push(["discussTaskSourceDraft", input]);
        return { assistantMessage: "继续澄清。" };
      },
    },
    taskSourceMutationService: {
      async createTaskSourceFromText(input) {
        calls.push(["createTaskSourceFromText", input]);
        return { fileName: "drafted-task.yaml" };
      },
      async commitTaskSourceFromDraft(input) {
        calls.push(["commitTaskSourceFromDraft", input]);
        return { commitSha: "abc1234" };
      },
    },
    terminalSessionService: {
      createTerminalSession(input) {
        calls.push(["createTerminalSession", input]);
        return { id: "terminal-session-1" };
      },
      writeTerminalSessionInput(input) {
        calls.push(["writeTerminalSessionInput", input]);
        return { id: "terminal-session-1", output: [] };
      },
      cancelTerminalSession(input) {
        calls.push(["cancelTerminalSession", input]);
        return { id: "terminal-session-1", status: "cancelled" };
      },
      getLatestTerminalSession() {
        calls.push(["getLatestTerminalSession"]);
        return { id: "terminal-session-1", status: "running" };
      },
    },
    workflowEventBus: {
      onEvent(observedListener) {
        calls.push(["onEvent", observedListener]);
        return unsubscribe;
      },
      clear() {
        calls.push(["clear"]);
      },
    },
    taskSourceWatcher: {
      async start() {
        calls.push(["start"]);
      },
      stop() {
        calls.push(["stop"]);
      },
    },
    toRecommendationSnapshot(run) {
      calls.push(["toRecommendationSnapshot", run]);
      return { snapshotId: run.id };
    },
  });

  return { calls, listener, runtime, unsubscribe };
}

test("workflow service runtime delegates read, fixture, and recommendation operations", async () => {
  const { calls, runtime } = createRuntimeHarness();

  assert.deepEqual(runtime.listTasks(), [{ fileName: "task.yaml" }]);
  assert.deepEqual(await runtime.listTaskPool(), { taskContextPackages: [] });
  assert.deepEqual(await runtime.getStartupCheck(), { ok: true });
  assert.deepEqual(await runtime.seedTestStateFixtures({ fixtureKey: "human-guided-execution" }), {
    seeded: true,
  });
  assert.deepEqual(await runtime.cleanupTestStateFixtures(), { cleaned: true });
  assert.deepEqual(await runtime.createRecommendationRun(), { id: "run-2" });
  assert.deepEqual(runtime.cancelRecommendationRun(), { cancelled: true });
  assert.deepEqual(runtime.updateRecommendationRunStageSwitches({
    stageSwitches: { executionAdmission: true },
  }), { updated: true });
  assert.deepEqual(runtime.getLatestRecommendationRun(), { snapshotId: "run-1" });

  assert.deepEqual(calls, [
    ["listTasks"],
    ["listTaskPool"],
    ["getStartupCheck"],
    ["seedTestStateFixtures", { fixtureKey: "human-guided-execution" }],
    ["cleanupTestStateFixtures"],
    ["createRecommendationRun"],
    ["cancelRecommendationRun"],
    ["updateRecommendationRunStageSwitches", { stageSwitches: { executionAdmission: true } }],
    ["getLatestRecommendationRun"],
    ["toRecommendationSnapshot", { id: "run-1", status: "completed" }],
  ]);
});

test("workflow service runtime delegates manual workflow actions with default inputs", async () => {
  const { calls, runtime } = createRuntimeHarness();

  assert.deepEqual(await runtime.acceptConvergenceSuccess(), { accepted: true });
  assert.deepEqual(await runtime.replanAutoMerge(), { planned: true });
  assert.deepEqual(await runtime.continueConvergenceWithGuidance(), { continued: true });
  assert.deepEqual(await runtime.cancelTask(), { cancelled: true });

  assert.deepEqual(calls, [
    ["acceptConvergenceSuccess", { packageId: null }],
    ["replanAutoMerge", { packageId: null }],
    [
      "continueConvergenceWithGuidance",
      {
        packageId: null,
        guidance: "",
        focusAreas: [],
        avoidRepeating: [],
        expectedNextOutcome: "",
      },
    ],
    ["cancelTask", { packageId: null }],
  ]);
});

test("workflow service runtime delegates manual workflow actions with provided inputs", async () => {
  const { calls, runtime } = createRuntimeHarness();

  await runtime.acceptConvergenceSuccess({ packageId: "pkg-1" });
  await runtime.replanAutoMerge({ packageId: "pkg-2" });
  await runtime.continueConvergenceWithGuidance({
    packageId: "pkg-3",
    guidance: "继续收窄。",
    focusAreas: ["tests"],
    avoidRepeating: "不要重复。",
    expectedNextOutcome: "证明修复路径。",
  });
  await runtime.cancelTask({ packageId: "pkg-4" });

  assert.deepEqual(calls, [
    ["acceptConvergenceSuccess", { packageId: "pkg-1" }],
    ["replanAutoMerge", { packageId: "pkg-2" }],
    [
      "continueConvergenceWithGuidance",
      {
        packageId: "pkg-3",
        guidance: "继续收窄。",
        focusAreas: ["tests"],
        avoidRepeating: "不要重复。",
        expectedNextOutcome: "证明修复路径。",
      },
    ],
    ["cancelTask", { packageId: "pkg-4" }],
  ]);
});

test("workflow service runtime delegates task source draft discussion", async () => {
  const { calls, runtime } = createRuntimeHarness();

  assert.deepEqual(
    await runtime.discussTaskSourceDraft({
      mode: "discuss",
      messages: [{ role: "user", content: "做一个导入功能" }],
    }),
    { assistantMessage: "继续澄清。" },
  );

  assert.deepEqual(calls, [[
    "discussTaskSourceDraft",
    {
      mode: "discuss",
      messages: [{ role: "user", content: "做一个导入功能" }],
    },
  ]]);
});

test("workflow service runtime delegates task source draft creation", async () => {
  const { calls, runtime } = createRuntimeHarness();

  assert.deepEqual(
    await runtime.createTaskSourceFromDraft({
      taskSourceText: "id: drafted-task\n",
    }),
    { fileName: "drafted-task.yaml" },
  );

  assert.deepEqual(calls, [[
    "createTaskSourceFromText",
    {
      taskSourceText: "id: drafted-task\n",
    },
  ]]);
});

test("workflow service runtime delegates task source draft commit", async () => {
  const { calls, runtime } = createRuntimeHarness();

  assert.deepEqual(
    await runtime.commitTaskSourceFromDraft({ fileName: "drafted-task.yaml" }),
    { commitSha: "abc1234" },
  );

  assert.deepEqual(calls, [[
    "commitTaskSourceFromDraft",
    { fileName: "drafted-task.yaml" },
  ]]);
});

test("workflow service runtime delegates event subscription and watcher lifecycle", async () => {
  const { calls, listener, runtime, unsubscribe } = createRuntimeHarness();

  assert.equal(runtime.onEvent(listener), unsubscribe);
  await runtime.startWatching();
  runtime.stopWatching();

  assert.deepEqual(calls, [
    ["onEvent", listener],
    ["start"],
    ["stop"],
    ["clear"],
  ]);
});

test("workflow service runtime delegates terminal session operations", () => {
  const { calls, runtime } = createRuntimeHarness();

  assert.deepEqual(runtime.createTerminalSession({ command: "node" }), { id: "terminal-session-1" });
  assert.deepEqual(runtime.writeTerminalSessionInput({
    sessionId: "terminal-session-1",
    input: "1 + 1\n",
  }), { id: "terminal-session-1", output: [] });
  assert.deepEqual(runtime.cancelTerminalSession({ sessionId: "terminal-session-1" }), {
    id: "terminal-session-1",
    status: "cancelled",
  });
  assert.deepEqual(runtime.getLatestTerminalSession(), {
    id: "terminal-session-1",
    status: "running",
  });

  assert.deepEqual(calls, [
    ["createTerminalSession", { command: "node" }],
    ["writeTerminalSessionInput", { sessionId: "terminal-session-1", input: "1 + 1\n" }],
    ["cancelTerminalSession", { sessionId: "terminal-session-1" }],
    ["getLatestTerminalSession"],
  ]);
});
