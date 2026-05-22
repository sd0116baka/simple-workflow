import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allArtifactRecords,
  artifactBody,
  artifactById,
  artifactRecord,
  artifactRecordsFromValue,
  hasArtifactBody,
  latestArtifactRecord,
  multiArtifactRecords,
} from "../public/task-package-artifacts.js";

test("browser task package artifact accessors separate single and multi records", () => {
  const taskContextPackage = {
    artifacts: {
      executionIntent: {
        artifactId: "executionIntent",
        body: { confidence: "high" },
      },
      executionReport: [
        { artifactId: "executionReport:001", body: { status: "needs-work" } },
        { artifactId: "executionReport:002", body: { status: "succeeded" } },
      ],
      malformedSingle: [
        { artifactId: "malformedSingle", body: { status: "should-not-read" } },
      ],
    },
  };

  assert.equal(artifactRecord(taskContextPackage, "executionIntent").artifactId, "executionIntent");
  assert.deepEqual(artifactBody(taskContextPackage, "executionIntent"), { confidence: "high" });
  assert.equal(hasArtifactBody(taskContextPackage, "executionIntent"), true);
  assert.equal(artifactRecord(taskContextPackage, "malformedSingle"), null);
  assert.equal(artifactBody(taskContextPackage, "malformedSingle"), null);
  assert.equal(hasArtifactBody(taskContextPackage, "malformedSingle"), false);
  assert.deepEqual(multiArtifactRecords(taskContextPackage, "executionReport").map((record) => record.artifactId), [
    "executionReport:001",
    "executionReport:002",
  ]);
  assert.equal(latestArtifactRecord(taskContextPackage, "executionReport").artifactId, "executionReport:002");
  assert.deepEqual(artifactRecordsFromValue(taskContextPackage.artifacts.executionIntent), [
    taskContextPackage.artifacts.executionIntent,
  ]);
  assert.deepEqual(artifactRecordsFromValue(null), []);
  assert.equal(artifactById(taskContextPackage, "executionReport:001").artifactType, "executionReport");
  assert.deepEqual(allArtifactRecords(taskContextPackage).map((item) => item.artifact.artifactId), [
    "executionIntent",
    "executionReport:001",
    "executionReport:002",
    "malformedSingle",
  ]);
});
