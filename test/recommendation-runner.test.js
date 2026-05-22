import { test } from "node:test";
import assert from "node:assert/strict";
import { runOpencodeRecommendation } from "../src/workflow/recommendation-runner.js";

test("opencode recommendation runner can run through terminal sessions", async () => {
  const calls = [];
  const progress = [];
  const terminalSessions = [];
  const terminalSessionService = {
    async runTerminalCommand(input) {
      calls.push(input);
      input.onStarted({ id: "terminal-session-1", status: "running" });
      input.onStdoutChunk(`${JSON.stringify({
        type: "text",
        part: { text: "推荐 task-001" },
      })}\n`);
      input.onFinish();
      return {
        stdout: `${JSON.stringify({
          type: "text",
          part: { text: "推荐 task-001" },
        })}\n`,
        stderr: "warn",
        exitCode: 0,
        error: null,
        terminalSession: { id: "terminal-session-1" },
      };
    },
  };

  const result = await runOpencodeRecommendation({
    prompt: "pick one",
    terminalSessionService,
    onTerminalSession: (session) => terminalSessions.push(session),
    onProgress: (entry) => progress.push(entry),
  });

  assert.equal(calls[0].prompt, "pick one");
  assert.equal(calls[0].title, "任务推荐器");
  assert.equal(result.stdout, "推荐 task-001");
  assert.equal(result.stderr, "warn");
  assert.equal(result.exitCode, 0);
  assert.equal(result.terminalSessionId, "terminal-session-1");
  assert.deepEqual(terminalSessions, [{ id: "terminal-session-1", status: "running" }]);
  assert.equal(progress[0].type, "text");
});
