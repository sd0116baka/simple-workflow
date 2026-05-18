import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeMainAgent } from "../src/workflow/main-agent-flow.js";

function authorizedPackage() {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    taskDraft: {
      id: "task-003",
    },
    artifacts: {
      executionIntent: {
        artifactId: "executionIntent",
        body: {},
        appendedAt: "2026-05-18T09:00:00.000Z",
      },
      executionAuthorization: {
        artifactId: "executionAuthorization",
        body: {},
        appendedAt: "2026-05-18T09:01:00.000Z",
      },
    },
    agentRuns: [],
  };
}

test("initializes main agent session without producing an artifact", () => {
  const init = initializeMainAgent({
    taskContextPackage: authorizedPackage(),
    runAgentSession: ({ role, packageId }) => ({
      sessionId: `session:${role}:${packageId}`,
      status: "succeeded",
    }),
    now: () => "2026-05-18T10:00:00.000Z",
  });

  assert.equal(init.error, null);
  assert.equal(init.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(init.appendRequest.artifactType, undefined);
  assert.equal(init.appendRequest.agentRun.role, "main");
  assert.equal(
    init.appendRequest.agentRun.sessionId,
    "session:main:task-context-package:tasks/task-003.yaml",
  );
  assert.deepEqual(init.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
  ]);
  assert.deepEqual(init.appendRequest.agentRun.outputArtifactRefs, []);
});

test("does not initialize main agent before execution authorization exists", () => {
  const taskPackage = authorizedPackage();
  delete taskPackage.artifacts.executionAuthorization;

  const init = initializeMainAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(init.appendRequest, null);
  assert.match(init.error, /缺少执行授权/);
});
