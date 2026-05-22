import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAppendRequestToTaskPackage } from "../src/workflow/task-package-append-request.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

function taskPackage() {
  return createTaskContextPackageFixture({
    currentWorkStage: "task-pool",
    artifacts: {},
    agentRuns: [],
    timeline: [],
  });
}

function executionAgentRun() {
  return {
    runId: "execution-agent:001",
    role: "execution",
    sessionId: "session:execution",
    inputArtifactRefs: ["taskDraft"],
    outputArtifactRefs: [],
    status: "succeeded",
    startedAt: "2026-05-21T00:00:00.000Z",
    finishedAt: "2026-05-21T00:01:00.000Z",
  };
}

test("task package append request records single artifacts", () => {
  const updated = applyAppendRequestToTaskPackage(taskPackage(), {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType: "executionIntent",
    artifact: {
      confidence: "high",
      appendedAt: "2026-05-21T00:00:30.000Z",
    },
  }, {
    currentWorkStage: "task-recommender",
  });

  assert.equal(updated.currentWorkStage, "task-recommender");
  assert.equal(updated.artifacts.executionIntent.artifactId, "executionIntent");
  assert.deepEqual(updated.artifacts.executionIntent.body, {
    confidence: "high",
    appendedAt: "2026-05-21T00:00:30.000Z",
  });
  assert.equal(updated.timeline[0].artifactType, "executionIntent");
  assert.equal(updated.timeline[0].artifactId, "executionIntent");
});

test("task package append request records multi artifacts and output refs", () => {
  const first = applyAppendRequestToTaskPackage(taskPackage(), {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType: "executionReport",
    artifact: { summary: "first" },
    agentRun: executionAgentRun(),
  });
  const second = applyAppendRequestToTaskPackage(first, {
    packageId: "task-context-package:tasks/task-001.yaml",
    artifactType: "executionReport",
    artifact: { summary: "second" },
    agentRun: {
      ...executionAgentRun(),
      runId: "execution-agent:002",
      sessionId: "session:execution:002",
      finishedAt: "2026-05-21T00:02:00.000Z",
    },
  });

  assert.deepEqual(second.artifacts.executionReport.map((record) => record.artifactId), [
    "executionReport:001",
    "executionReport:002",
  ]);
  assert.deepEqual(second.agentRuns.map((agentRun) => agentRun.outputArtifactRefs), [
    ["executionReport:001"],
    ["executionReport:002"],
  ]);
  assert.equal(second.timeline.at(-1).artifactId, "executionReport:002");
  assert.equal(second.timeline.at(-1).agentRunId, "execution-agent:002");
});

test("task package append request records agent runs without artifacts", () => {
  const updated = applyAppendRequestToTaskPackage(taskPackage(), {
    packageId: "task-context-package:tasks/task-001.yaml",
    agentRun: {
      ...executionAgentRun(),
      role: "main",
      runId: "main-agent:initialization",
      sessionId: "session:main",
    },
  });

  assert.deepEqual(updated.artifacts, {});
  assert.deepEqual(updated.agentRuns[0].outputArtifactRefs, []);
  assert.equal(updated.timeline[0].artifactType, null);
  assert.equal(updated.timeline[0].agentRunId, "main-agent:initialization");
});
