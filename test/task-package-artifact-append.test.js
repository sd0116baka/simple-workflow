import { test } from "node:test";
import assert from "node:assert/strict";
import { appendArtifact } from "../src/workflow/task-package-artifact-append.js";

test("task package artifact append records single artifacts", () => {
  const { artifacts, artifactId } = appendArtifact({}, {
    artifactType: "executionIntent",
    artifact: { confidence: "high" },
  }, "2026-05-21T00:00:00.000Z");

  assert.equal(artifactId, "executionIntent");
  assert.deepEqual(artifacts.executionIntent, {
    artifactId: "executionIntent",
    body: { confidence: "high" },
    appendedAt: "2026-05-21T00:00:00.000Z",
  });
});

test("task package artifact append assigns sequential ids for multi artifacts", () => {
  const first = appendArtifact({}, {
    artifactType: "executionReport",
    artifact: { summary: "first" },
  }, "2026-05-21T00:00:00.000Z");
  const second = appendArtifact(first.artifacts, {
    artifactType: "executionReport",
    artifact: { summary: "second" },
  }, "2026-05-21T00:01:00.000Z");

  assert.deepEqual(second.artifacts.executionReport.map((record) => record.artifactId), [
    "executionReport:001",
    "executionReport:002",
  ]);
  assert.equal(second.artifactId, "executionReport:002");
});
