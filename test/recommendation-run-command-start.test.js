import { test } from "node:test";
import assert from "node:assert/strict";
import { startRecommendationRunCommand } from "../src/workflow/recommendation-run-command-start.js";
import { createRunningRecommendationRunFixture } from "./support/recommendation-run-fixtures.js";

test("recommendation command start creates controller and hands command to completion", async () => {
  const run = createRunningRecommendationRunFixture();
  const signal = { aborted: false };
  const calls = [];
  let capturedStartedCommand;
  let capturedProgress;

  const snapshot = startRecommendationRunCommand({
    run,
    runRecommendationCommand(input) {
      calls.push(["command", input]);
      return {
        stdout: "ok",
        stderr: "",
        exitCode: 0,
      };
    },
    recommendationRunControllerRegistry: {
      create(runId) {
        calls.push(["create", runId]);
        return { signal };
      },
    },
    recommendationRunCompletion: {
      finishRecommendationRun(inputRun, startedCommand, onProgress) {
        calls.push(["finish", inputRun.id]);
        capturedStartedCommand = startedCommand;
        capturedProgress = onProgress;
      },
    },
    emitRecommendationChanged(inputRun) {
      calls.push(["emit", inputRun.id, inputRun.progress.length]);
    },
  });

  assert.equal(snapshot.id, "recommendation-run-1");
  assert.deepEqual(calls.slice(0, 2), [
    ["create", "recommendation-run-1"],
    ["finish", "recommendation-run-1"],
  ]);

  const result = await capturedStartedCommand;
  assert.deepEqual(result, {
    stdout: "ok",
    stderr: "",
    exitCode: 0,
  });
  assert.equal(calls[2][0], "command");
  assert.equal(calls[2][1].prompt, "recommend a task");
  assert.equal(calls[2][1].signal, signal);
  assert.equal(calls[2][1].run.id, "recommendation-run-1");
  assert.notEqual(calls[2][1].run, run);

  calls[2][1].run.args.push("mutated");
  assert.deepEqual(run.args, ["run"]);
  calls[2][1].onTerminalSession({ id: "terminal-session-1" });
  assert.equal(run.terminalSessionId, "terminal-session-1");
  assert.equal(calls.at(-1)[0], "emit");

  capturedProgress({
    stage: "recommendation",
    message: "received output",
  });
  assert.equal(run.progress.length, 1);
  assert.equal(run.progress[0].stage, "recommendation");
  assert.equal(calls.at(-1)[0], "emit");
  assert.equal(calls.at(-1)[2], 1);
});

test("recommendation command start routes rejected command promises to completion", async () => {
  const run = createRunningRecommendationRunFixture();
  let capturedStartedCommand;

  startRecommendationRunCommand({
    run,
    runRecommendationCommand() {
      throw new Error("command failed");
    },
    recommendationRunControllerRegistry: {
      create() {
        return { signal: { aborted: false } };
      },
    },
    recommendationRunCompletion: {
      finishRecommendationRun(_run, startedCommand) {
        capturedStartedCommand = startedCommand;
      },
    },
    emitRecommendationChanged() {},
  });

  await assert.rejects(capturedStartedCommand, /command failed/);
});
