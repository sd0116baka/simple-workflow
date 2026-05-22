import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeMainAgent } from "../src/workflow/main-agent-flow.js";
import {
  createArtifactRecordFixture,
  createTaskContextPackageFixture,
} from "./support/task-context-package-fixtures.js";

function authorizedPackage() {
  return createTaskContextPackageFixture({
    packageId: "task-context-package:tasks/task-003.yaml",
    taskDraft: {
      id: "task-003",
    },
    artifacts: {
      executionIntent: createArtifactRecordFixture("executionIntent", {}, {
        appendedAt: "2026-05-18T09:00:00.000Z",
      }),
      executionAuthorization: createArtifactRecordFixture("executionAuthorization", {}, {
        appendedAt: "2026-05-18T09:01:00.000Z",
      }),
    },
    agentRuns: [],
  });
}

test("initializes main agent session without producing an artifact", async () => {
  let observed = null;
  const init = await initializeMainAgent({
    taskContextPackage: authorizedPackage(),
    runAgentSession: ({ role, packageId, runId, inputArtifactRefs }) => {
      observed = { role, packageId, runId, inputArtifactRefs };
      return {
        sessionId: `session:${role}:${packageId}`,
        status: "succeeded",
      };
    },
    now: () => "2026-05-18T10:00:00.000Z",
  });

  assert.equal(init.error, null);
  assert.equal(init.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(init.appendRequest.artifactType, undefined);
  assert.equal(init.appendRequest.agentRun.runId, "main-agent:initialization");
  assert.equal(init.appendRequest.agentRun.role, "main");
  assert.equal(
    init.appendRequest.agentRun.sessionId,
    "session:main:task-context-package:tasks/task-003.yaml",
  );
  assert.deepEqual(observed, {
    role: "main",
    packageId: "task-context-package:tasks/task-003.yaml",
    runId: "main-agent:initialization",
    inputArtifactRefs: [
      "taskDraft",
      "executionIntent",
      "executionAuthorization",
    ],
  });
  assert.deepEqual(init.appendRequest.agentRun, {
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
    finishedAt: "2026-05-18T10:00:00.000Z",
  });
});

test("does not initialize main agent before execution authorization exists", async () => {
  const taskPackage = authorizedPackage();
  delete taskPackage.artifacts.executionAuthorization;

  const init = await initializeMainAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(init.appendRequest, null);
  assert.match(init.error, /缺少执行授权/);
});

test("awaits asynchronous main agent session runners", async () => {
  const init = await initializeMainAgent({
    taskContextPackage: authorizedPackage(),
    runAgentSession: async ({ runId }) => ({
      sessionId: `async-session:${runId}`,
      status: "succeeded",
    }),
    now: () => "2026-05-18T10:00:00.000Z",
  });

  assert.equal(init.error, null);
  assert.equal(init.appendRequest.agentRun.sessionId, "async-session:main-agent:initialization");
});
