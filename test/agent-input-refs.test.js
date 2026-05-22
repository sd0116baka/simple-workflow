import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inputArtifactRefsForConvergence,
  inputArtifactRefsForExecution,
  inputArtifactRefsForReview,
} from "../src/workflow/agent-input-refs.js";
import {
  createArtifactRecordFixture as record,
  createTaskContextPackageFixture,
} from "./support/task-context-package-fixtures.js";

test("builds first-round execution, review, and convergence input refs", () => {
  const taskPackage = createTaskContextPackageFixture({
    artifacts: {
      executionReport: [record("executionReport:001")],
      reviewReport: [record("reviewReport:001")],
    },
  });

  assert.deepEqual(inputArtifactRefsForExecution(taskPackage), [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "isolatedWorkspace",
  ]);
  assert.deepEqual(inputArtifactRefsForReview(taskPackage, record("executionReport:001")), [
    "taskDraft",
    "executionAuthorization",
    "isolatedWorkspace",
    "executionReport:001",
  ]);
  assert.deepEqual(inputArtifactRefsForConvergence(
    taskPackage,
    record("executionReport:001"),
    record("reviewReport:001"),
  ), [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "executionReport:001",
    "reviewReport:001",
  ]);
});

test("places automatic convergence advice before the next execution and convergence reports", () => {
  const taskPackage = createTaskContextPackageFixture({
    artifacts: {
      convergenceAdvice: [record("convergenceAdvice:001")],
    },
  });

  assert.deepEqual(inputArtifactRefsForExecution(taskPackage), [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
    "isolatedWorkspace",
  ]);
  assert.deepEqual(inputArtifactRefsForConvergence(
    taskPackage,
    record("executionReport:002"),
    record("reviewReport:002"),
  ), [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
    "executionReport:002",
    "reviewReport:002",
  ]);
});

test("places human correction refs before workspace and reviewed artifacts", () => {
  const taskPackage = createTaskContextPackageFixture({
    artifacts: {
      convergenceFailure: [record("convergenceFailure:001")],
      humanConvergenceGuidance: [record("humanConvergenceGuidance:001")],
    },
  });

  assert.deepEqual(inputArtifactRefsForExecution(taskPackage), [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceFailure:001",
    "humanConvergenceGuidance:001",
    "isolatedWorkspace",
  ]);
  assert.deepEqual(inputArtifactRefsForReview(taskPackage, record("executionReport:002")), [
    "taskDraft",
    "executionAuthorization",
    "convergenceFailure:001",
    "humanConvergenceGuidance:001",
    "isolatedWorkspace",
    "executionReport:002",
  ]);
  assert.deepEqual(inputArtifactRefsForConvergence(
    taskPackage,
    record("executionReport:002"),
    record("reviewReport:002"),
  ), [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceFailure:001",
    "humanConvergenceGuidance:001",
    "executionReport:002",
    "reviewReport:002",
  ]);
});
