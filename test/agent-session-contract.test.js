import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAgentSessionRequest,
  createStubAgentSession,
  normalizeAgentProcessStatus,
} from "../src/workflow/agent-session-contract.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

test("creates agent session request with stable input artifact refs", () => {
  const inputArtifactRefs = ["taskDraft", "executionReport:001"];
  const request = createAgentSessionRequest({
    role: "review",
    packageId: "pkg-1",
    taskContextPackage: createTaskContextPackageFixture({ packageId: "pkg-1" }),
    runId: "review-agent:001",
    sessionId: "session:main",
    inputArtifactRefs,
    cwd: "/tmp/worktree",
    onProgress: () => {},
    signal: { aborted: false },
  });
  inputArtifactRefs.push("reviewReport:001");

  assert.equal(request.role, "review");
  assert.equal(request.packageId, "pkg-1");
  assert.equal(request.runId, "review-agent:001");
  assert.equal(request.sessionId, "session:main");
  assert.equal(request.cwd, "/tmp/worktree");
  assert.deepEqual(request.inputArtifactRefs, ["taskDraft", "executionReport:001"]);
  assert.equal(typeof request.onProgress, "function");
  assert.equal(request.signal.aborted, false);
});

test("creates deterministic stub agent sessions", () => {
  assert.deepEqual(createStubAgentSession({ role: "review", packageId: "pkg-1" }), {
    sessionId: "stub-review-session:pkg-1",
    status: "succeeded",
  });
});

test("normalizes agent process status from exits and errors", () => {
  assert.equal(normalizeAgentProcessStatus({ exitCode: 0 }), "succeeded");
  assert.equal(normalizeAgentProcessStatus({ exitCode: 1 }), "failed");
  assert.equal(normalizeAgentProcessStatus({ exitCode: 0, error: "cancelled" }), "failed");
  assert.equal(normalizeAgentProcessStatus({ error: "spawn failed" }), "failed");
});
