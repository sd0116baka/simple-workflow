import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecommendationRunTransaction } from "../src/workflow/recommendation-run-creation.js";
import { createRecommendationRunLifecycleState } from "../src/workflow/recommendation-run-lifecycle-state.js";
import { createRecommendationRunFixture } from "./support/recommendation-run-fixtures.js";

test("recommendation run creation returns latest snapshot when a run is already running", async () => {
  const state = createRecommendationRunLifecycleState();
  const run = createRecommendationRunFixture();
  state.setLatestRun(run);

  const snapshot = await createRecommendationRunTransaction({
    tasksDir: "tasks",
    recommendationPromptPath: "prompt.md",
    taskContextWorkspace: {
      loadExistingTaskContextPackages() {
        throw new Error("running guard should not load packages");
      },
    },
    getStartupCheck() {
      throw new Error("running guard should not read startup check");
    },
    runRecommendationCommand() {},
    recommendationRunLifecycleState: state,
    recommendationRunControllerRegistry: {},
    recommendationRunCompletion: {},
    emitRecommendationChanged() {
      throw new Error("running guard should not emit");
    },
    listTasks() {
      throw new Error("running guard should not read tasks");
    },
    startFlow() {
      throw new Error("running guard should not start flow");
    },
  });

  assert.equal(snapshot.id, "recommendation-run-1");
  assert.notEqual(snapshot, run);
  snapshot.args.push("mutated");
  assert.deepEqual(run.args, ["run"]);
});

test("recommendation run creation stores and emits blocked runs without starting command", async () => {
  const state = createRecommendationRunLifecycleState();
  const previousRun = createRecommendationRunFixture({
    id: "recommendation-run-previous",
    status: "succeeded",
  });
  state.setLatestRun(previousRun);
  const calls = [];
  const blockedRun = createRecommendationRunFixture({
    status: "blocked",
    error: "startup check blocked",
  });

  const snapshot = await createRecommendationRunTransaction({
    tasksDir: "tasks",
    recommendationPromptPath: "prompt.md",
    taskContextWorkspace: {
      loadExistingTaskContextPackages(input) {
        calls.push(["load-packages", input.latestRecommendationRun.id]);
        return [{ taskId: "task-1" }];
      },
    },
    getStartupCheck() {
      calls.push(["startup"]);
      return { canStartWork: false };
    },
    runRecommendationCommand() {
      throw new Error("blocked run should not start command");
    },
    recommendationRunLifecycleState: state,
    recommendationRunControllerRegistry: {},
    recommendationRunCompletion: {},
    emitRecommendationChanged(run) {
      calls.push(["emit", run.id, run.status]);
    },
    listTasks(tasksDir) {
      calls.push(["list-tasks", tasksDir]);
      return [{ id: "task-1" }];
    },
    startFlow(input) {
      calls.push([
        "start-flow",
        input.id,
        input.tasks.length,
        input.startupCheck.canStartWork,
        input.recommendationPromptPath,
        input.existingTaskContextPackages.length,
      ]);
      return { run: blockedRun };
    },
    startCommand() {
      throw new Error("blocked run should not start command");
    },
  });

  assert.deepEqual(calls, [
    ["startup"],
    ["list-tasks", "tasks"],
    ["load-packages", "recommendation-run-previous"],
    ["start-flow", "recommendation-run-1", 1, false, "prompt.md", 1],
    ["emit", "recommendation-run-1", "blocked"],
  ]);
  assert.equal(state.getLatestRun(), blockedRun);
  assert.equal(snapshot.status, "blocked");
  assert.notEqual(snapshot, blockedRun);
});

test("recommendation run creation starts command for running runs", async () => {
  const state = createRecommendationRunLifecycleState();
  const run = createRecommendationRunFixture();
  const registry = {};
  const completion = {};
  const command = () => {};
  const emitted = [];
  const emitRecommendationChanged = (inputRun) => {
    emitted.push(inputRun);
  };
  let capturedStartCommand;

  const snapshot = await createRecommendationRunTransaction({
    tasksDir: "tasks",
    recommendationPromptPath: "prompt.md",
    taskContextWorkspace: {
      loadExistingTaskContextPackages() {
        return [];
      },
    },
    getStartupCheck() {
      return { canStartWork: true };
    },
    runRecommendationCommand: command,
    recommendationRunLifecycleState: state,
    recommendationRunControllerRegistry: registry,
    recommendationRunCompletion: completion,
    emitRecommendationChanged,
    listTasks() {
      return [];
    },
    startFlow() {
      return { run };
    },
    startCommand(input) {
      capturedStartCommand = input;
      return { id: input.run.id, status: input.run.status };
    },
  });

  assert.equal(state.getLatestRun(), run);
  assert.deepEqual(emitted, [run]);
  assert.deepEqual(snapshot, {
    id: "recommendation-run-1",
    status: "running",
  });
  assert.equal(capturedStartCommand.run, run);
  assert.equal(capturedStartCommand.runRecommendationCommand, command);
  assert.equal(capturedStartCommand.recommendationRunControllerRegistry, registry);
  assert.equal(capturedStartCommand.recommendationRunCompletion, completion);
  assert.equal(capturedStartCommand.emitRecommendationChanged, emitRecommendationChanged);
});
