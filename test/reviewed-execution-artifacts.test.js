import { test } from "node:test";
import assert from "node:assert/strict";
import {
  latestExecutionReport,
  latestReviewReport,
  latestReviewedExecutionArtifacts,
} from "../src/workflow/reviewed-execution-artifacts.js";
import {
  createArtifactRecordFixture,
  createTaskContextPackageFixture,
} from "./support/task-context-package-fixtures.js";

function record(artifactId) {
  return createArtifactRecordFixture(artifactId, { artifactId });
}

test("selects latest execution and review reports as a reviewed execution pair", () => {
  const taskPackage = createTaskContextPackageFixture({
    artifacts: {
      executionReport: [
        record("executionReport:001"),
        record("executionReport:002"),
      ],
      reviewReport: [
        record("reviewReport:001"),
        record("reviewReport:002"),
      ],
    },
  });

  assert.equal(latestExecutionReport(taskPackage).artifactId, "executionReport:002");
  assert.equal(latestReviewReport(taskPackage).artifactId, "reviewReport:002");
  assert.deepEqual(latestReviewedExecutionArtifacts(taskPackage), {
    executionReport: record("executionReport:002"),
    reviewReport: record("reviewReport:002"),
  });
});

test("returns null slots when the reviewed execution pair is incomplete", () => {
  assert.deepEqual(latestReviewedExecutionArtifacts(createTaskContextPackageFixture()), {
    executionReport: null,
    reviewReport: null,
  });
  assert.deepEqual(latestReviewedExecutionArtifacts(createTaskContextPackageFixture({
    artifacts: {
      executionReport: [record("executionReport:001")],
    },
  })), {
    executionReport: record("executionReport:001"),
    reviewReport: null,
  });
});
