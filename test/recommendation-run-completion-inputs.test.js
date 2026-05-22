import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRecommendationRunCompletionInput } from "../src/workflow/recommendation-run-completion-inputs.js";

test("recommendation run completion input loading gathers flow inputs in order", async () => {
  const calls = [];
  const run = { id: "recommendation-run-1" };
  const commandResult = { stdout: "{}", stderr: "", exitCode: 0 };
  const signal = { aborted: false };
  const onProgress = () => {};
  const mainSession = () => {};
  const executionSession = () => {};
  const reviewSession = () => {};
  const convergenceSession = () => {};

  const input = await loadRecommendationRunCompletionInput({
    run,
    commandResult,
    tasksDir: "tasks-dir",
    repositoryDir: "repo-dir",
    taskContextWorkspace: {
      async loadExistingTaskContextPackages(request) {
        calls.push(["loadExistingTaskContextPackages", request]);
        return [{ packageId: "existing-package" }];
      },
    },
    async getStartupCheck() {
      calls.push(["getStartupCheck"]);
      return { canStartWork: true };
    },
    getLatestRecommendationRun() {
      calls.push(["getLatestRecommendationRun"]);
      return { id: "latest-run" };
    },
    runMainAgentSession: mainSession,
    runExecutionAgentSession: executionSession,
    runReviewAgentSession: reviewSession,
    runConvergenceSession: convergenceSession,
    recommendationRunControllerRegistry: {
      signalFor(runId) {
        calls.push(["signalFor", runId]);
        return signal;
      },
    },
    onProgress,
    async listTasks(tasksDir) {
      calls.push(["listTasks", tasksDir]);
      return [{ fileName: "task.yaml" }];
    },
  });

  assert.deepEqual(calls, [
    ["listTasks", "tasks-dir"],
    ["getStartupCheck"],
    ["getLatestRecommendationRun"],
    [
      "loadExistingTaskContextPackages",
      { latestRecommendationRun: { id: "latest-run" } },
    ],
    ["signalFor", "recommendation-run-1"],
  ]);
  assert.equal(input.run, run);
  assert.equal(input.commandResult, commandResult);
  assert.deepEqual(input.tasks, [{ fileName: "task.yaml" }]);
  assert.deepEqual(input.startupCheck, { canStartWork: true });
  assert.deepEqual(input.projectProfile, {
    defaults: {
      maxIterations: 3,
    },
  });
  assert.deepEqual(input.existingTaskContextPackages, [{ packageId: "existing-package" }]);
  assert.equal(input.runMainAgentSession, mainSession);
  assert.equal(input.runExecutionAgentSession, executionSession);
  assert.equal(input.runReviewAgentSession, reviewSession);
  assert.equal(input.runConvergenceSession, convergenceSession);
  assert.equal(input.repositoryDir, "repo-dir");
  assert.equal(input.onProgress, onProgress);
  assert.equal(input.signal, signal);
});
