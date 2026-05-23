import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agentSessionErrorMessage,
  agentSessionFailure,
  buildAgentProcessFailure,
  normalizeAgentProcessStatus,
} from "../src/workflow/agent-failure-model.js";

test("agent failure model classifies cancelled process results", () => {
  const failure = buildAgentProcessFailure({ role: "execution", cancelled: true });

  assert.deepEqual(failure, {
    code: "agent.cancelled",
    kind: "cancelled",
    message: "execution agent 已取消。",
    exitCode: null,
    error: "cancelled",
    stderr: null,
  });
  assert.equal(normalizeAgentProcessStatus({ failure }), "cancelled");
});

test("agent failure model uses stderr as non-zero exit message", () => {
  const failure = buildAgentProcessFailure({
    role: "review",
    exitCode: 1,
    stderr: "review command failed\nstack trace",
  });

  assert.equal(failure.code, "agent.non-zero-exit");
  assert.equal(failure.kind, "non-zero-exit");
  assert.equal(failure.message, "review command failed\nstack trace");
  assert.equal(failure.exitCode, 1);
  assert.equal(normalizeAgentProcessStatus({ failure }), "failed");
});

test("agent failure model reads failure from agent sessions", () => {
  const session = {
    role: "main",
    status: "failed",
    rawOutput: {
      exitCode: null,
      error: "spawn opencode ENOENT",
      stderr: "",
    },
  };

  assert.equal(agentSessionFailure(session).code, "agent.process-error");
  assert.equal(agentSessionErrorMessage(session), "spawn opencode ENOENT");
});

test("agent failure model treats failed sessions without raw output as invocation failures", () => {
  const failure = agentSessionFailure({
    role: "review",
    status: "failed",
  });

  assert.equal(failure.code, "agent.process-error");
  assert.equal(failure.message, "review agent 运行失败。");
});
