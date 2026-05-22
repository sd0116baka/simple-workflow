import { test } from "node:test";
import assert from "node:assert/strict";
import {
  artifactRecord,
  createStateFixtureTraceRecorder,
} from "../src/workflow/state-fixture-trace-recorder.js";

function emptyPackage() {
  return {
    artifacts: {},
    agentRuns: [],
    timeline: [],
  };
}

test("records single artifacts, multi artifacts, and agent runs into a linear timeline", () => {
  const taskPackage = emptyPackage();
  const recorder = createStateFixtureTraceRecorder(taskPackage);

  recorder.addArtifact("executionIntent", artifactRecord(
    "executionIntent",
    { confidence: "low" },
    "2026-05-21T00:00:00.000Z",
  ));
  recorder.addMultiArtifact("executionReport", artifactRecord(
    "executionReport:001",
    { status: "succeeded" },
    "2026-05-21T00:01:00.000Z",
  ));
  recorder.addAgentRun({
    runId: "execution-agent:001",
    finishedAt: "2026-05-21T00:02:00.000Z",
  });

  assert.deepEqual(taskPackage.artifacts.executionIntent.body, { confidence: "low" });
  assert.deepEqual(taskPackage.artifacts.executionReport.map((record) => record.artifactId), [
    "executionReport:001",
  ]);
  assert.deepEqual(taskPackage.agentRuns.map((agentRun) => agentRun.runId), [
    "execution-agent:001",
  ]);
  assert.deepEqual(taskPackage.timeline, [
    {
      artifactType: "executionIntent",
      artifactId: "executionIntent",
      agentRunId: null,
      appendedAt: "2026-05-21T00:00:00.000Z",
    },
    {
      artifactType: "executionReport",
      artifactId: "executionReport:001",
      agentRunId: null,
      appendedAt: "2026-05-21T00:01:00.000Z",
    },
    {
      artifactType: null,
      artifactId: null,
      agentRunId: "execution-agent:001",
      appendedAt: "2026-05-21T00:02:00.000Z",
    },
  ]);
});

test("records append requests into fixture records and resettable agent runs", () => {
  const taskPackage = emptyPackage();
  const recorder = createStateFixtureTraceRecorder(taskPackage);

  const appendRequest = {
    artifact: { summary: "fixture report" },
    agentRun: {
      runId: "execution-agent:001",
      outputArtifactRefs: [],
    },
  };

  recorder.addRequestMultiArtifact(
    "executionReport",
    "executionReport:001",
    appendRequest,
    "2026-05-21T00:00:00.000Z",
  );
  recorder.addRequestAgentRun(appendRequest, ["executionReport:001"]);
  recorder.reset();

  assert.deepEqual(taskPackage.artifacts, {});
  assert.deepEqual(taskPackage.agentRuns, []);
  assert.deepEqual(taskPackage.timeline, []);
});

test("records append request artifacts with their producing agent run", () => {
  const taskPackage = emptyPackage();
  const recorder = createStateFixtureTraceRecorder(taskPackage);

  const appendRequest = {
    artifact: { summary: "fixture review" },
    agentRun: {
      runId: "review-agent:001",
      finishedAt: "2026-05-21T00:02:00.000Z",
      outputArtifactRefs: [],
    },
  };

  recorder.addRequestMultiArtifactWithAgentRun(
    "reviewReport",
    "reviewReport:001",
    appendRequest,
    "2026-05-21T00:01:00.000Z",
  );

  assert.deepEqual(taskPackage.artifacts.reviewReport, [
    {
      artifactId: "reviewReport:001",
      body: { summary: "fixture review" },
      appendedAt: "2026-05-21T00:01:00.000Z",
    },
  ]);
  assert.deepEqual(taskPackage.agentRuns, [
    {
      runId: "review-agent:001",
      finishedAt: "2026-05-21T00:02:00.000Z",
      outputArtifactRefs: ["reviewReport:001"],
    },
  ]);
  assert.deepEqual(
    taskPackage.timeline.map((event) => event.artifactType ?? event.agentRunId),
    ["reviewReport", "review-agent:001"],
  );
});
