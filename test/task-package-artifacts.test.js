import { test } from "node:test";
import assert from "node:assert/strict";
import { latestArtifactRecord } from "../src/workflow/task-package-artifacts.js";

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
});

test("returns null when an artifact record is missing or not a multi artifact array", () => {
  assert.equal(latestArtifactRecord({ artifacts: {} }, "reviewReport"), null);
  assert.equal(
    latestArtifactRecord({ artifacts: { executionAuthorization: { artifactId: "executionAuthorization" } } }, "executionAuthorization"),
    null,
  );
});
