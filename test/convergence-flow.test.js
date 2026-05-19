import { test } from "node:test";
import assert from "node:assert/strict";
import { runConvergence } from "../src/workflow/convergence-flow.js";

function convergenceReadyPackage() {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
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
      executionReport: [
        {
          artifactId: "executionReport:001",
          body: {},
          appendedAt: "2026-05-18T10:00:01.000Z",
        },
      ],
      reviewReport: [
        {
          artifactId: "reviewReport:001",
          body: {},
          appendedAt: "2026-05-18T10:00:02.000Z",
        },
      ],
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

test("runs convergence with main agent session and requests advice append", () => {
  const result = runConvergence({
    taskContextPackage: convergenceReadyPackage(),
    runAgentSession: ({ role, sessionId }) => ({
      sessionId: `resumed:${role}:${sessionId}`,
      status: "succeeded",
    }),
    now: () => "2026-05-18T10:00:03.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "convergenceAdvice");
  assert.equal(result.appendRequest.artifact.summary, "stub convergence advice");
  assert.deepEqual(result.appendRequest.artifact.basis, [
    "executionReport:001",
    "reviewReport:001",
  ]);
  assert.equal(result.appendRequest.agentRun.runId, "main-agent:convergence:001");
  assert.equal(result.appendRequest.agentRun.role, "main");
  assert.equal(result.appendRequest.agentRun.sessionId, "resumed:main:session:main");
  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "executionReport:001",
    "reviewReport:001",
  ]);
});

test("increments convergence run id from existing advice", () => {
  const taskPackage = convergenceReadyPackage();
  taskPackage.artifacts.convergenceAdvice = [
    {
      artifactId: "convergenceAdvice:001",
      body: {},
      appendedAt: "2026-05-18T10:00:03.000Z",
    },
  ];

  const result = runConvergence({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest.agentRun.runId, "main-agent:convergence:002");
});

test("completes task after a reviewed execution that used convergence advice", () => {
  const taskPackage = convergenceReadyPackage();
  taskPackage.artifacts.convergenceAdvice = [
    {
      artifactId: "convergenceAdvice:001",
      body: {},
      appendedAt: "2026-05-18T10:00:03.000Z",
    },
  ];
  taskPackage.artifacts.executionReport.push({
    artifactId: "executionReport:002",
    body: {},
    appendedAt: "2026-05-18T10:00:04.000Z",
  });
  taskPackage.artifacts.reviewReport.push({
    artifactId: "reviewReport:002",
    body: {
      outcome: "passed",
    },
    appendedAt: "2026-05-18T10:00:05.000Z",
  });

  const result = runConvergence({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest.artifactType, "taskCompletion");
  assert.deepEqual(result.appendRequest.artifact.basis, [
    "executionReport:002",
    "reviewReport:002",
  ]);
  assert.equal(result.appendRequest.agentRun.runId, "main-agent:convergence:002");
  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
    "executionReport:002",
    "reviewReport:002",
  ]);
});

test("does not run convergence before review report exists", () => {
  const taskPackage = convergenceReadyPackage();
  delete taskPackage.artifacts.reviewReport;

  const result = runConvergence({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 reviewReport/);
});
