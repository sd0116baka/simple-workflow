import { test } from "node:test";
import assert from "node:assert/strict";
import { runExecutionAgent } from "../src/workflow/execution-agent-flow.js";

function executablePackage() {
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
    agentRuns: [
      {
        runId: "main-agent:initialization",
        role: "main",
        sessionId: "session:main",
        inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization"],
        outputArtifactRefs: [],
        status: "succeeded",
        startedAt: "2026-05-18T10:00:00.000Z",
        finishedAt: "2026-05-18T10:00:00.000Z",
      },
    ],
  };
}

test("runs execution agent stub and requests execution report append", () => {
  const result = runExecutionAgent({
    taskContextPackage: executablePackage(),
    runAgentSession: ({ role, packageId }) => ({
      sessionId: `session:${role}:${packageId}`,
      status: "succeeded",
    }),
    now: () => "2026-05-18T10:00:01.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "executionReport");
  assert.equal(result.appendRequest.artifact.summary, "stub execution completed");
  assert.equal(result.appendRequest.agentRun.runId, "execution-agent:001");
  assert.equal(result.appendRequest.agentRun.role, "execution");
  assert.equal(
    result.appendRequest.agentRun.sessionId,
    "session:execution:task-context-package:tasks/task-003.yaml",
  );
  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
  ]);
});

test("increments execution agent run id from existing execution reports", () => {
  const taskPackage = executablePackage();
  taskPackage.artifacts.executionReport = [
    {
      artifactId: "executionReport:001",
      body: {},
      appendedAt: "2026-05-18T10:00:01.000Z",
    },
  ];

  const result = runExecutionAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest.agentRun.runId, "execution-agent:002");
});

test("uses latest convergence advice as next execution input", () => {
  const taskPackage = executablePackage();
  taskPackage.artifacts.executionReport = [
    {
      artifactId: "executionReport:001",
      body: {},
      appendedAt: "2026-05-18T10:00:01.000Z",
    },
  ];
  taskPackage.artifacts.convergenceAdvice = [
    {
      artifactId: "convergenceAdvice:001",
      body: {},
      appendedAt: "2026-05-18T10:00:03.000Z",
    },
  ];

  const result = runExecutionAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest.agentRun.runId, "execution-agent:002");
  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
  ]);
});

test("does not run execution agent before main agent is initialized", () => {
  const taskPackage = executablePackage();
  taskPackage.agentRuns = [];

  const result = runExecutionAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 main agent 初始化记录/);
});
