import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMainAgentInitializationRequest,
  MAIN_AGENT_INITIALIZATION_INPUT_REFS,
  MAIN_AGENT_INITIALIZATION_RUN_ID,
} from "../src/workflow/main-agent-contract.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

test("builds main agent initialization append request", () => {
  const appendRequest = buildMainAgentInitializationRequest({
    taskContextPackage: createTaskContextPackageFixture({
      packageId: "task-context-package:tasks/task-003.yaml",
    }),
    session: {
      sessionId: "session:main:task-context-package:tasks/task-003.yaml",
      status: "succeeded",
    },
    startedAt: "2026-05-18T10:00:00.000Z",
    finishedAt: "2026-05-18T10:00:01.000Z",
  });

  assert.equal(MAIN_AGENT_INITIALIZATION_RUN_ID, "main-agent:initialization");
  assert.deepEqual(MAIN_AGENT_INITIALIZATION_INPUT_REFS, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
  ]);
  assert.deepEqual(appendRequest, {
    packageId: "task-context-package:tasks/task-003.yaml",
    agentRun: {
      runId: "main-agent:initialization",
      role: "main",
      sessionId: "session:main:task-context-package:tasks/task-003.yaml",
      inputArtifactRefs: [
        "taskDraft",
        "executionIntent",
        "executionAuthorization",
      ],
      outputArtifactRefs: [],
      status: "succeeded",
      startedAt: "2026-05-18T10:00:00.000Z",
      finishedAt: "2026-05-18T10:00:01.000Z",
    },
  });
});
