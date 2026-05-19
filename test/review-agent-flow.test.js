import { test } from "node:test";
import assert from "node:assert/strict";
import { runReviewAgent } from "../src/workflow/review-agent-flow.js";

function reviewablePackage() {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    artifacts: {
      executionAuthorization: {
        artifactId: "executionAuthorization",
        body: {},
        appendedAt: "2026-05-18T09:01:00.000Z",
      },
      executionReport: [
        {
          artifactId: "executionReport:001",
          body: {
            summary: "stub execution completed",
          },
          appendedAt: "2026-05-18T10:00:01.000Z",
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
      {
        runId: "execution-agent:001",
        role: "execution",
        sessionId: "session:execution",
        inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization"],
        outputArtifactRefs: ["executionReport:001"],
        status: "succeeded",
        startedAt: "2026-05-18T10:00:01.000Z",
        finishedAt: "2026-05-18T10:00:01.000Z",
      },
    ],
  };
}

test("runs review agent stub and requests review report append", () => {
  const result = runReviewAgent({
    taskContextPackage: reviewablePackage(),
    runAgentSession: ({ role, packageId }) => ({
      sessionId: `session:${role}:${packageId}`,
      status: "succeeded",
    }),
    now: () => "2026-05-18T10:00:02.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "reviewReport");
  assert.equal(result.appendRequest.artifact.outcome, "passed");
  assert.equal(result.appendRequest.agentRun.runId, "review-agent:001");
  assert.equal(result.appendRequest.agentRun.role, "review");
  assert.equal(
    result.appendRequest.agentRun.sessionId,
    "session:review:task-context-package:tasks/task-003.yaml",
  );
  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionAuthorization",
    "executionReport:001",
  ]);
});

test("increments review agent run id from existing review reports", () => {
  const taskPackage = reviewablePackage();
  taskPackage.artifacts.reviewReport = [
    {
      artifactId: "reviewReport:001",
      body: {},
      appendedAt: "2026-05-18T10:00:02.000Z",
    },
  ];

  const result = runReviewAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest.agentRun.runId, "review-agent:002");
});

test("does not run review agent before execution report exists", () => {
  const taskPackage = reviewablePackage();
  delete taskPackage.artifacts.executionReport;

  const result = runReviewAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 executionReport/);
});
