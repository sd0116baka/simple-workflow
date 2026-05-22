import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReviewReportRequest } from "../src/workflow/review-report-contract.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

const taskContextPackage = createTaskContextPackageFixture({
  packageId: "task-context-package:tasks/task-003.yaml",
});

test("builds passed review report append request defaults", () => {
  const appendRequest = buildReviewReportRequest({
    taskContextPackage,
    runId: "review-agent:001",
    session: {
      sessionId: "session:review:001",
    },
    inputArtifactRefs: ["taskDraft", "executionAuthorization", "isolatedWorkspace", "executionReport:001"],
    startedAt: "2026-05-21T12:00:00.000Z",
    finishedAt: "2026-05-21T12:01:00.000Z",
  });

  assert.deepEqual(appendRequest, {
    packageId: "task-context-package:tasks/task-003.yaml",
    artifactType: "reviewReport",
    artifact: {
      outcome: "passed",
      summary: "stub review passed",
      findings: [],
    },
    agentRun: {
      runId: "review-agent:001",
      role: "review",
      sessionId: "session:review:001",
      inputArtifactRefs: ["taskDraft", "executionAuthorization", "isolatedWorkspace", "executionReport:001"],
      outputArtifactRefs: [],
      status: "succeeded",
      startedAt: "2026-05-21T12:00:00.000Z",
      finishedAt: "2026-05-21T12:01:00.000Z",
    },
  });
});

test("builds failed review report append request with findings", () => {
  const findings = [
    { code: "not-converged", message: "review found unfinished work" },
  ];
  const appendRequest = buildReviewReportRequest({
    taskContextPackage,
    runId: "review-agent:002",
    session: {
      sessionId: "session:review:002",
      status: "failed",
    },
    inputArtifactRefs: [
      "taskDraft",
      "executionAuthorization",
      "convergenceAdvice:001",
      "isolatedWorkspace",
      "executionReport:002",
    ],
    outcome: "failed",
    summary: "review found unfinished work",
    findings,
    startedAt: "2026-05-21T12:02:00.000Z",
    finishedAt: "2026-05-21T12:03:00.000Z",
  });

  assert.equal(appendRequest.artifact.outcome, "failed");
  assert.equal(appendRequest.artifact.summary, "review found unfinished work");
  assert.equal(appendRequest.artifact.findings, findings);
  assert.equal(appendRequest.agentRun.status, "failed");
  assert.deepEqual(appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionAuthorization",
    "convergenceAdvice:001",
    "isolatedWorkspace",
    "executionReport:002",
  ]);
});
