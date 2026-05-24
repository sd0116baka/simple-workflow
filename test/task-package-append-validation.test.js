import { test } from "node:test";
import assert from "node:assert/strict";
import { assertAppendRequest } from "../src/workflow/task-package-append-validation.js";

function executionAgentRun() {
  return {
    runId: "execution-agent:001",
    role: "execution",
    sessionId: "session:execution",
    inputArtifactRefs: ["taskDraft"],
    outputArtifactRefs: [],
    status: "succeeded",
    startedAt: "2026-05-21T00:00:00.000Z",
    finishedAt: "2026-05-21T00:01:00.000Z",
  };
}

test("task package append validation requires an append target and payload", () => {
  assert.throws(() => assertAppendRequest(null), /appendRequest\.packageId is required/);
  assert.throws(() => assertAppendRequest({
    packageId: "task-context-package:tasks/task-001.yaml",
  }), /appendRequest requires artifact or agentRun/);
  assert.throws(() => assertAppendRequest({
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType: "executionIntent",
    artifact: null,
  }), /appendRequest\.artifact must be an object/);
});

test("task package append validation checks agent run shape", () => {
  assert.throws(() => assertAppendRequest({
    packageId: "task-context-package:tasks/task-001.yaml",
    agentRun: {
      ...executionAgentRun(),
      role: "other",
    },
  }), /appendRequest\.agentRun\.role must be main, execution, or review/);
  assert.throws(() => assertAppendRequest({
    packageId: "task-context-package:tasks/task-001.yaml",
    agentRun: {
      ...executionAgentRun(),
      inputArtifactRefs: null,
    },
  }), /appendRequest\.agentRun\.inputArtifactRefs must be an array/);
});

test("task package append validation rejects runtime debug data on agent runs", () => {
  for (const field of ["prompt", "transcript", "stdout", "stderr", "rawOutput", "events", "command", "cwd", "pid"]) {
    assert.throws(() => assertAppendRequest({
      packageId: "task-context-package:tasks/task-001.yaml",
      agentRun: {
        ...executionAgentRun(),
        [field]: "debug payload",
      },
    }), new RegExp(`appendRequest\\.agentRun\\.${field} is runtime debug data`));
  }
});
