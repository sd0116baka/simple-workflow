import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStageTimelineEntryNodes } from "../public/stage-timeline-entry-nodes.js";

function artifact(artifactId, body = {}) {
  return { artifactId, body, appendedAt: "2026-05-20T10:00:00.000Z" };
}

test("stage timeline entry nodes preserve ordered stage trace with repeated execution agents", () => {
  const nodes = buildStageTimelineEntryNodes({
    packageId: "tasks-demo",
    artifacts: {
      executionIntent: artifact("executionIntent"),
      executionReport: [artifact("executionReport:001")],
      humanDecisionRequest: artifact("humanDecisionRequest"),
      humanConvergenceGuidance: [artifact("humanConvergenceGuidance:001")],
    },
    agentRuns: [
      {
        runId: "execution-agent:001",
        role: "execution",
        finishedAt: "2026-05-20T10:01:00.000Z",
      },
      {
        runId: "execution-agent:002",
        role: "execution",
        finishedAt: "2026-05-20T10:05:00.000Z",
      },
    ],
    timeline: [
      { artifactType: "executionIntent", artifactId: "executionIntent", appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: "executionReport", artifactId: "executionReport:001", appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: null, artifactId: null, agentRunId: "execution-agent:001", appendedAt: "2026-05-20T10:01:00.000Z" },
      { artifactType: "humanDecisionRequest", artifactId: "humanDecisionRequest", appendedAt: "2026-05-20T10:02:00.000Z" },
      { artifactType: "humanConvergenceGuidance", artifactId: "humanConvergenceGuidance:001", appendedAt: "2026-05-20T10:03:00.000Z" },
      { artifactType: null, artifactId: null, agentRunId: "execution-agent:002", appendedAt: "2026-05-20T10:05:00.000Z" },
    ],
  });

  assert.deepEqual(nodes.map((node) => node.stage), [
    "task-recommender",
    "execution-agent",
    "human-decision",
    "execution-agent",
  ]);
  assert.equal(nodes[1].evidence, "execution-agent:001");
  assert.equal(nodes[2].detail, "humanDecisionRequest -> humanConvergenceGuidance:001");
  assert.equal(nodes[3].evidence, "execution-agent:002");
  assert.equal(nodes[3].timestamp, "2026-05-20T10:05:00.000Z");
});

test("stage timeline entry nodes collapse convergence artifact and agent implementation details", () => {
  const nodes = buildStageTimelineEntryNodes({
    packageId: "tasks-demo",
    artifacts: {
      convergenceFailure: [artifact("convergenceFailure:001")],
    },
    agentRuns: [
      {
        runId: "main-agent:convergence:001",
        role: "main",
        finishedAt: "2026-05-20T10:04:00.000Z",
      },
    ],
    timeline: [
      { artifactType: "convergenceFailure", artifactId: "convergenceFailure:001", appendedAt: "2026-05-20T10:03:00.000Z" },
      { artifactType: null, artifactId: null, agentRunId: "main-agent:convergence:001", appendedAt: "2026-05-20T10:04:00.000Z" },
      { artifactType: "unknownArtifact", artifactId: "unknownArtifact:001", appendedAt: "2026-05-20T10:05:00.000Z" },
    ],
  });

  assert.deepEqual(nodes.map((node) => node.stage), ["convergence"]);
  assert.equal(nodes[0].evidence, "convergenceFailure:001");
});
