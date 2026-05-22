import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExecutionReportRequest } from "../src/workflow/execution-report-contract.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

const taskContextPackage = createTaskContextPackageFixture({
  packageId: "task-context-package:tasks/task-003.yaml",
});

test("builds execution report append request with normalized cwd", () => {
  const appendRequest = buildExecutionReportRequest({
    taskContextPackage,
    runId: "execution-agent:001",
    session: {
      sessionId: "session:execution:001",
      status: "succeeded",
      summary: "implemented workflow change",
      tests: ["npm test"],
      notes: ["changed task source watcher"],
      rawOutput: { stdout: "done" },
    },
    inputArtifactRefs: ["taskDraft", "executionAuthorization", "isolatedWorkspace"],
    reportCwd: ".workflow\\worktrees\\tasks\\task-003",
    changedFiles: ["src/workflow/task-source-watcher.js"],
    startedAt: "2026-05-21T11:00:00.000Z",
    finishedAt: "2026-05-21T11:01:00.000Z",
  });

  assert.deepEqual(appendRequest, {
    packageId: "task-context-package:tasks/task-003.yaml",
    artifactType: "executionReport",
    artifact: {
      summary: "implemented workflow change",
      status: "succeeded",
      cwd: ".workflow/worktrees/tasks/task-003",
      changedFiles: ["src/workflow/task-source-watcher.js"],
      tests: ["npm test"],
      notes: ["changed task source watcher"],
      rawOutput: { stdout: "done" },
    },
    agentRun: {
      runId: "execution-agent:001",
      role: "execution",
      sessionId: "session:execution:001",
      inputArtifactRefs: ["taskDraft", "executionAuthorization", "isolatedWorkspace"],
      outputArtifactRefs: [],
      status: "succeeded",
      startedAt: "2026-05-21T11:00:00.000Z",
      finishedAt: "2026-05-21T11:01:00.000Z",
    },
  });
});

test("builds execution report defaults from minimal session output", () => {
  const appendRequest = buildExecutionReportRequest({
    taskContextPackage,
    runId: "execution-agent:002",
    session: {
      sessionId: "session:execution:002",
    },
    inputArtifactRefs: ["taskDraft", "executionAuthorization", "convergenceAdvice:001", "isolatedWorkspace"],
    reportCwd: ".workflow/worktrees/tasks/task-003",
    changedFiles: [],
    startedAt: "2026-05-21T11:02:00.000Z",
    finishedAt: "2026-05-21T11:03:00.000Z",
  });

  assert.equal(appendRequest.artifact.summary, "stub execution completed");
  assert.equal(appendRequest.artifact.status, "succeeded");
  assert.deepEqual(appendRequest.artifact.tests, []);
  assert.deepEqual(appendRequest.artifact.notes, []);
  assert.equal(appendRequest.artifact.rawOutput, null);
  assert.equal(appendRequest.agentRun.status, "succeeded");
});
