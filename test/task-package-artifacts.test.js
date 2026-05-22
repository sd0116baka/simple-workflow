import { test } from "node:test";
import assert from "node:assert/strict";
import {
  artifactBody,
  artifactRecord,
  hasArtifactBody,
  latestArtifactBody,
  latestArtifactRecord,
  multiArtifactRecordCount,
  multiArtifactRecords,
} from "../src/workflow/task-package-artifacts.js";

test("returns single artifact records and bodies without accepting multi artifacts", () => {
  const taskContextPackage = {
    artifacts: {
      executionAuthorization: {
        artifactId: "executionAuthorization",
        body: { maxIterations: 3 },
      },
      executionReport: [
        { artifactId: "executionReport:001", body: { status: "succeeded" } },
      ],
    },
  };

  assert.deepEqual(
    artifactRecord(taskContextPackage, "executionAuthorization"),
    {
      artifactId: "executionAuthorization",
      body: { maxIterations: 3 },
    },
  );
  assert.deepEqual(
    artifactBody(taskContextPackage, "executionAuthorization"),
    { maxIterations: 3 },
  );
  assert.equal(hasArtifactBody(taskContextPackage, "executionAuthorization"), true);
  assert.equal(artifactRecord(taskContextPackage, "executionReport"), null);
  assert.equal(artifactBody(taskContextPackage, "missingArtifact"), null);
  assert.equal(hasArtifactBody(taskContextPackage, "missingArtifact"), false);
});

test("returns the latest artifact record for multi artifact arrays", () => {
  const taskContextPackage = {
    artifacts: {
      executionReport: [
        { artifactId: "executionReport:001" },
        { artifactId: "executionReport:002" },
      ],
    },
  };

  assert.deepEqual(
    latestArtifactRecord(taskContextPackage, "executionReport"),
    { artifactId: "executionReport:002" },
  );
  assert.deepEqual(
    multiArtifactRecords(taskContextPackage, "executionReport"),
    [
      { artifactId: "executionReport:001" },
      { artifactId: "executionReport:002" },
    ],
  );
  assert.equal(multiArtifactRecordCount(taskContextPackage, "executionReport"), 2);
});

test("returns null when an artifact record is missing or not a multi artifact array", () => {
  assert.equal(latestArtifactRecord({ artifacts: {} }, "reviewReport"), null);
  assert.equal(
    latestArtifactRecord({ artifacts: { executionAuthorization: { artifactId: "executionAuthorization" } } }, "executionAuthorization"),
    null,
  );
  assert.deepEqual(
    multiArtifactRecords({ artifacts: { executionAuthorization: { artifactId: "executionAuthorization" } } }, "executionAuthorization"),
    [],
  );
  assert.equal(
    multiArtifactRecordCount({ artifacts: { executionAuthorization: { artifactId: "executionAuthorization" } } }, "executionAuthorization"),
    0,
  );
});

test("returns latest artifact body for multi artifacts", () => {
  const taskContextPackage = {
    artifacts: {
      convergenceAdvice: [
        { artifactId: "convergenceAdvice:001", body: { summary: "first" } },
        { artifactId: "convergenceAdvice:002", body: { summary: "second" } },
      ],
    },
  };

  assert.deepEqual(
    latestArtifactBody(taskContextPackage, "convergenceAdvice"),
    { summary: "second" },
  );
  assert.equal(latestArtifactBody({ artifacts: {} }, "convergenceAdvice"), null);
});
