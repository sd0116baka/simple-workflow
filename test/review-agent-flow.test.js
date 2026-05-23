import { test } from "node:test";
import assert from "node:assert/strict";
import { runReviewAgent } from "../src/workflow/review-agent-flow.js";
import { createArtifactRecordFixture } from "./support/task-context-package-fixtures.js";
import { createReviewReadyPackageFixture } from "./support/review-ready-package-fixtures.js";

function reviewablePackage() {
  return createReviewReadyPackageFixture({ worktreePath: "." });
}

test("runs review agent stub and requests review report append", async () => {
  let observed = null;
  const onProgress = () => {};
  const signal = { aborted: false };
  const result = await runReviewAgent({
    taskContextPackage: reviewablePackage(),
    onProgress,
    signal,
    runAgentSession: ({ role, packageId, cwd, runId, inputArtifactRefs, onProgress: progress, signal: runSignal }) => {
      observed = { role, packageId, cwd, runId, inputArtifactRefs, onProgress: progress, signal: runSignal };
      return {
        sessionId: `session:${role}:${packageId}`,
        status: "succeeded",
      };
    },
    now: () => "2026-05-18T10:00:02.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "reviewReport");
  assert.deepEqual(result.appendRequest.artifact, {
    outcome: "passed",
    summary: "stub review passed",
    findings: [],
  });
  assert.equal(result.appendRequest.agentRun.runId, "review-agent:001");
  assert.equal(result.appendRequest.agentRun.role, "review");
  assert.equal(
    result.appendRequest.agentRun.sessionId,
    "session:review:task-context-package:tasks/task-003.yaml",
  );
  assert.deepEqual(observed, {
    role: "review",
    packageId: "task-context-package:tasks/task-003.yaml",
    cwd: process.cwd(),
    runId: "review-agent:001",
    inputArtifactRefs: [
      "taskDraft",
      "executionAuthorization",
      "isolatedWorkspace",
      "executionReport:001",
    ],
    onProgress,
    signal,
  });
  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionAuthorization",
    "isolatedWorkspace",
    "executionReport:001",
  ]);
});

test("increments review agent run id from existing review reports", async () => {
  const taskPackage = reviewablePackage();
  taskPackage.artifacts.reviewReport = [
    createArtifactRecordFixture("reviewReport:001", {}, {
      appendedAt: "2026-05-18T10:00:02.000Z",
    }),
  ];

  const result = await runReviewAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest.agentRun.runId, "review-agent:002");
});

test("uses latest convergence advice when reviewing a later execution", async () => {
  const taskPackage = reviewablePackage();
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
  taskPackage.artifacts.reviewReport = [
    createArtifactRecordFixture("reviewReport:001", {}, {
      appendedAt: "2026-05-18T10:00:02.000Z",
    }),
  ];

  const result = await runReviewAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest.agentRun.runId, "review-agent:002");
  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionAuthorization",
    "convergenceAdvice:001",
    "isolatedWorkspace",
    "executionReport:002",
  ]);
});

test("does not run review agent before isolated workspace exists", async () => {
  const taskPackage = reviewablePackage();
  delete taskPackage.artifacts.isolatedWorkspace;

  const result = await runReviewAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 isolatedWorkspace/);
});

test("does not run review agent before execution report exists", async () => {
  const taskPackage = reviewablePackage();
  delete taskPackage.artifacts.executionReport;

  const result = await runReviewAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 executionReport/);
});

test("does not run review agent after failed execution report", async () => {
  const taskPackage = reviewablePackage();
  taskPackage.artifacts.executionReport = [
    createArtifactRecordFixture(
      "executionReport:001",
      {
        status: "failed",
      },
      {
        appendedAt: "2026-05-18T10:00:01.000Z",
      },
    ),
  ];
  taskPackage.agentRuns[1] = {
    ...taskPackage.agentRuns[1],
    status: "failed",
    outputArtifactRefs: ["executionReport:001"],
  };

  const result = await runReviewAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /失败的 execution agent/);
});

test("does not run review agent when isolated workspace path is missing", async () => {
  const result = await runReviewAgent({
    taskContextPackage: createReviewReadyPackageFixture({
      worktreePath: ".missing-review-worktree",
    }),
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /隔离工作树路径不存在/);
});

test("awaits asynchronous review agent session runners", async () => {
  const result = await runReviewAgent({
    taskContextPackage: reviewablePackage(),
    runAgentSession: async ({ runId }) => ({
      sessionId: `async-session:${runId}`,
      status: "succeeded",
    }),
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.agentRun.sessionId, "async-session:review-agent:001");
});

test("records review agent process failures without appending review report", async () => {
  const result = await runReviewAgent({
    taskContextPackage: reviewablePackage(),
    runAgentSession: ({ runId }) => ({
      sessionId: `failed-session:${runId}`,
      status: "failed",
      rawOutput: {
        exitCode: 1,
        error: null,
        stderr: "review process failed",
      },
    }),
  });

  assert.equal(result.error, "review process failed");
  assert.equal(result.appendRequest.artifactType, undefined);
  assert.equal(result.appendRequest.agentRun.status, "failed");
  assert.equal(result.appendRequest.agentRun.failure.code, "agent.non-zero-exit");
});
