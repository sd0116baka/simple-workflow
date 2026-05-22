import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecommendationRunCompletion } from "../src/workflow/recommendation-run-completion.js";

function createCompletionHarness(overrides = {}) {
  const calls = [];
  const latestRecommendationRun = { id: "latest-run" };
  const signal = { aborted: false };
  const completion = createRecommendationRunCompletion({
    tasksDir: "tasks-dir",
    repositoryDir: "repo-dir",
    taskContextWorkspace: {
      async loadExistingTaskContextPackages(input) {
        calls.push(["loadExistingTaskContextPackages", input]);
        return [{ packageId: "existing-package" }];
      },
    },
    async getStartupCheck() {
      calls.push(["getStartupCheck"]);
      return { canStartWork: true };
    },
    getLatestRecommendationRun() {
      calls.push(["getLatestRecommendationRun"]);
      return latestRecommendationRun;
    },
    async persistTaskContextPackage(taskContextPackage) {
      calls.push(["persistTaskContextPackage", taskContextPackage]);
    },
    runMainAgentSession: "main-session",
    runExecutionAgentSession: "execution-session",
    runReviewAgentSession: "review-session",
    runConvergenceSession: "convergence-session",
    recommendationRunControllerRegistry: {
      signalFor(runId) {
        calls.push(["signalFor", runId]);
        return signal;
      },
      delete(runId) {
        calls.push(["delete", runId]);
        return true;
      },
    },
    emitRecommendationChanged(run) {
      calls.push(["emitRecommendationChanged", run]);
    },
    async loadRecommendationRunCompletionInput(input) {
      calls.push(["loadRecommendationRunCompletionInput", input]);
      return {
        run: input.run,
        commandResult: input.commandResult,
        tasks: [{ fileName: "task.yaml" }],
        repositoryDir: input.repositoryDir,
        onProgress: input.onProgress,
        signal,
      };
    },
    async completeRecommendationFlow(input) {
      calls.push(["completeRecommendationFlow", input]);
      return {
        status: "succeeded",
        taskContextPackage: { packageId: "completed-package" },
      };
    },
    now: () => "2026-05-22T00:00:00.000Z",
    ...overrides,
  });

  return { calls, completion, signal };
}

test("recommendation run completion completes, persists, cleans controller, and emits", async () => {
  const { calls, completion, signal } = createCompletionHarness();
  const run = { id: "recommendation-run-1", status: "running" };
  const onProgress = () => {};

  await completion.finishRecommendationRun(
    run,
    Promise.resolve({ stdout: "{}", stderr: "", exitCode: 0 }),
    onProgress,
  );

  assert.equal(run.status, "succeeded");
  assert.deepEqual(run.taskContextPackage, { packageId: "completed-package" });
  assert.equal(calls[0][0], "loadRecommendationRunCompletionInput");
  assert.equal(calls[0][1].run, run);
  assert.deepEqual(calls[0][1].commandResult, { stdout: "{}", stderr: "", exitCode: 0 });
  assert.equal(calls[0][1].tasksDir, "tasks-dir");
  assert.equal(calls[0][1].repositoryDir, "repo-dir");
  assert.equal(calls[0][1].onProgress, onProgress);
  assert.equal(calls[1][0], "completeRecommendationFlow");
  assert.equal(calls[1][1].run, run);
  assert.deepEqual(calls[1][1].tasks, [{ fileName: "task.yaml" }]);
  assert.equal(calls[1][1].repositoryDir, "repo-dir");
  assert.equal(calls[1][1].onProgress, onProgress);
  assert.equal(calls[1][1].signal, signal);
  assert.deepEqual(calls[2], [
    "persistTaskContextPackage",
    { packageId: "completed-package" },
  ]);
  assert.deepEqual(calls[3], ["delete", "recommendation-run-1"]);
  assert.equal(calls[4][0], "emitRecommendationChanged");
});

test("recommendation run completion marks failed command results and emits", async () => {
  const { calls, completion } = createCompletionHarness();
  const run = { id: "recommendation-run-1", status: "running" };

  await completion.finishRecommendationRun(
    run,
    Promise.reject(new Error("command exploded")),
    () => {},
  );

  assert.deepEqual(run, {
    id: "recommendation-run-1",
    status: "failed",
    finishedAt: "2026-05-22T00:00:00.000Z",
    error: "command exploded",
  });
  assert.deepEqual(calls, [
    ["delete", "recommendation-run-1"],
    ["emitRecommendationChanged", run],
  ]);
});

test("recommendation run completion skips completed updates when run is cancelled", async () => {
  const { calls, completion } = createCompletionHarness();
  const run = { id: "recommendation-run-1", status: "cancelled" };

  await completion.finishRecommendationRun(
    run,
    Promise.resolve({ stdout: "{}", stderr: "", exitCode: 0 }),
    () => {},
  );

  assert.deepEqual(run, { id: "recommendation-run-1", status: "cancelled" });
  assert.deepEqual(calls, [["delete", "recommendation-run-1"]]);
});
