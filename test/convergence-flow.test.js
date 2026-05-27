import { test } from "node:test";
import assert from "node:assert/strict";
import { runConvergence } from "../src/workflow/convergence-flow.js";
import {
  createAgentRunFixture,
  createArtifactRecordFixture,
} from "./support/task-context-package-fixtures.js";
import { createConvergenceReadyPackageFixture } from "./support/convergence-ready-package-fixtures.js";

function convergenceReadyPackage() {
  return createConvergenceReadyPackageFixture();
}

test("runs convergence with main agent session and requests advice append", async () => {
  let observed = null;
  const result = await runConvergence({
    taskContextPackage: convergenceReadyPackage(),
    runAgentSession: ({ role, sessionId, runId, inputArtifactRefs }) => {
      observed = { role, sessionId, runId, inputArtifactRefs };
      return {
        sessionId: `resumed:${role}:${sessionId}`,
        status: "succeeded",
      };
    },
    now: () => "2026-05-18T10:00:03.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "convergenceAdvice");
  assert.deepEqual(result.appendRequest.artifact, {
    summary: "stub convergence advice",
    nextAction: "等待真实 main agent 根据执行和审查结果给出下一轮执行意见。",
    basis: ["executionReport:001", "reviewReport:001"],
  });
  assert.equal(result.appendRequest.agentRun.runId, "main-agent:convergence:001");
  assert.equal(result.appendRequest.agentRun.role, "main");
  assert.equal(result.appendRequest.agentRun.sessionId, "resumed:main:session:main");
  assert.deepEqual(observed, {
    role: "main",
    sessionId: "session:main",
    runId: "main-agent:convergence:001",
    inputArtifactRefs: [
      "taskDraft",
      "executionIntent",
      "executionAuthorization",
      "executionReport:001",
      "reviewReport:001",
    ],
  });
  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "executionReport:001",
    "reviewReport:001",
  ]);
});

test("completes task when first convergence decision is success", async () => {
  const taskPackage = convergenceReadyPackage();
  taskPackage.artifacts.reviewReport[0].body.outcome = "failed";

  const result = await runConvergence({
    taskContextPackage: taskPackage,
    runAgentSession: () => ({
      sessionId: "session:converged",
      status: "succeeded",
      summary: "main 判断已经收敛",
      convergenceDecision: "success",
    }),
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "convergenceSuccess");
  assert.equal(result.appendRequest.artifact.summary, "main 判断已经收敛");
  assert.equal(result.appendRequest.agentRun.runId, "main-agent:convergence:001");
});

test("increments convergence run id from existing advice", async () => {
  const taskPackage = convergenceReadyPackage();
  taskPackage.artifacts.convergenceAdvice = [
    createArtifactRecordFixture("convergenceAdvice:001", {}, {
      appendedAt: "2026-05-18T10:00:03.000Z",
    }),
  ];

  const result = await runConvergence({
    taskContextPackage: taskPackage,
    runAgentSession: () => ({
      sessionId: "session:converged",
      status: "succeeded",
      convergenceDecision: "success",
    }),
  });

  assert.equal(result.appendRequest.agentRun.runId, "main-agent:convergence:002");
});

test("completes task after a reviewed execution that used convergence advice", async () => {
  const taskPackage = convergenceReadyPackage();
  taskPackage.artifacts.convergenceAdvice = [
    createArtifactRecordFixture("convergenceAdvice:001", {}, {
      appendedAt: "2026-05-18T10:00:03.000Z",
    }),
  ];
  taskPackage.artifacts.executionReport.push(
    createArtifactRecordFixture("executionReport:002", {}, {
      appendedAt: "2026-05-18T10:00:04.000Z",
    }),
  );
  taskPackage.artifacts.reviewReport.push(
    createArtifactRecordFixture(
      "reviewReport:002",
      {
        outcome: "passed",
      },
      {
        appendedAt: "2026-05-18T10:00:05.000Z",
      },
    ),
  );

  const result = await runConvergence({
    taskContextPackage: taskPackage,
    runAgentSession: () => ({
      sessionId: "session:converged",
      status: "succeeded",
      convergenceDecision: "success",
    }),
  });

  assert.equal(result.appendRequest.artifactType, "convergenceSuccess");
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

test("returns convergence failure when automatic iteration budget is exhausted", async () => {
  const taskPackage = convergenceReadyPackage();
  taskPackage.artifacts.convergenceAdvice = [
    createArtifactRecordFixture(
      "convergenceAdvice:001",
      {
        summary: "first fix",
      },
      {
        appendedAt: "2026-05-18T10:00:03.000Z",
      },
    ),
  ];
  taskPackage.artifacts.executionReport.push(
    createArtifactRecordFixture("executionReport:002", {}, {
      appendedAt: "2026-05-18T10:00:04.000Z",
    }),
  );
  taskPackage.artifacts.reviewReport.push(
    createArtifactRecordFixture(
      "reviewReport:002",
      {
        outcome: "failed",
        findings: [{ code: "still-broken" }],
      },
      {
        appendedAt: "2026-05-18T10:00:05.000Z",
      },
    ),
  );

  const result = await runConvergence({
    taskContextPackage: taskPackage,
    maxIterations: 1,
  });

  assert.equal(result.appendRequest.artifactType, "convergenceFailure");
  assert.equal(result.appendRequest.artifact.reasonCode, "max-iterations-reached");
  assert.deepEqual(result.appendRequest.artifact.basisRefs, [
    "executionReport:002",
    "reviewReport:002",
  ]);
  assert.deepEqual(result.appendRequest.artifact.attemptedFixes, ["convergenceAdvice:001"]);
  assert.deepEqual(result.appendRequest.artifact.unresolvedIssues, [{ code: "still-broken" }]);
  assert.equal(result.appendRequest.artifact.completedIterations, 1);
  assert.deepEqual(result.appendRequest.agentRun.outputArtifactRefs, []);
});

test("includes human convergence guidance in the next convergence input", async () => {
  const taskPackage = convergenceReadyPackage();
  taskPackage.artifacts.convergenceFailure = [
    createArtifactRecordFixture("convergenceFailure:001", {}, {
      appendedAt: "2026-05-18T10:00:03.000Z",
    }),
  ];
  taskPackage.artifacts.humanConvergenceGuidance = [
    createArtifactRecordFixture(
      "humanConvergenceGuidance:001",
      {
        guidance: "先修正状态泄漏。",
      },
      {
        appendedAt: "2026-05-18T10:00:04.000Z",
      },
    ),
  ];

  const result = await runConvergence({
    taskContextPackage: taskPackage,
  });

  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceFailure:001",
    "humanConvergenceGuidance:001",
    "executionReport:001",
    "reviewReport:001",
  ]);
});

test("does not run convergence before review report exists", async () => {
  const taskPackage = convergenceReadyPackage();
  delete taskPackage.artifacts.reviewReport;

  const result = await runConvergence({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 reviewReport/);
});

test("does not run convergence after failed execution report", async () => {
  const taskPackage = createConvergenceReadyPackageFixture({
    executionReport: createArtifactRecordFixture(
      "executionReport:001",
      {
        status: "failed",
      },
      {
        appendedAt: "2026-05-18T10:00:01.000Z",
      },
    ),
    agentRuns: [
      createAgentRunFixture(),
      createAgentRunFixture({
        runId: "execution-agent:001",
        role: "execution",
        status: "failed",
        outputArtifactRefs: ["executionReport:001"],
      }),
    ],
  });

  const result = await runConvergence({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /失败的 execution agent/);
});

test("awaits asynchronous convergence session runners", async () => {
  const result = await runConvergence({
    taskContextPackage: convergenceReadyPackage(),
    runAgentSession: async ({ runId }) => ({
      sessionId: `async-session:${runId}`,
      status: "succeeded",
    }),
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.agentRun.sessionId, "async-session:main-agent:convergence:001");
});

test("records convergence process failures without appending convergence artifacts", async () => {
  const result = await runConvergence({
    taskContextPackage: convergenceReadyPackage(),
    runAgentSession: ({ runId }) => ({
      sessionId: `failed-session:${runId}`,
      status: "failed",
      rawOutput: {
        exitCode: 1,
        error: null,
        stderr: "main convergence failed",
      },
    }),
  });

  assert.equal(result.error, "main convergence failed");
  assert.equal(result.appendRequest.artifactType, undefined);
  assert.equal(result.appendRequest.agentRun.status, "failed");
  assert.equal(result.appendRequest.agentRun.failure.code, "agent.non-zero-exit");
});
