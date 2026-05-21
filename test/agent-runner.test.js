import { test } from "node:test";
import assert from "node:assert/strict";
import { createStubAgentSession, normalizeAgentStatus } from "../src/workflow/agent-runner.js";

test("creates deterministic stub agent sessions", () => {
  assert.deepEqual(createStubAgentSession({ role: "review", packageId: "pkg-1" }), {
    sessionId: "stub-review-session:pkg-1",
    status: "succeeded",
  });
});

test("normalizes agent process status from exits and errors", () => {
  assert.equal(normalizeAgentStatus({ exitCode: 0 }), "succeeded");
  assert.equal(normalizeAgentStatus({ exitCode: 1 }), "failed");
  assert.equal(normalizeAgentStatus({ exitCode: 0, error: "cancelled" }), "failed");
  assert.equal(normalizeAgentStatus({ error: "spawn failed" }), "failed");
});
