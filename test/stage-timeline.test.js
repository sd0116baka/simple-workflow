import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStageTimeline } from "../public/stage-timeline.js";

function artifact(artifactId, body = {}) {
  return { artifactId, body, appendedAt: "2026-05-20T10:00:00.000Z" };
}

function packageAfterHumanGuidance() {
  return {
    packageId: "tasks-demo",
    currentWorkStage: "execution-agent",
    fixture: {
      generatedAt: "2026-05-20T09:55:00.000Z",
    },
    artifacts: {
      executionIntent: artifact("executionIntent"),
      executionAuthorization: artifact("executionAuthorization"),
      isolatedWorkspace: artifact("isolatedWorkspace"),
      executionReport: [artifact("executionReport:001")],
      reviewReport: [artifact("reviewReport:001")],
      convergenceFailure: [artifact("convergenceFailure:001")],
      humanDecisionRequest: artifact("humanDecisionRequest", {
        targetRef: "convergenceFailure:001",
        decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
      }),
      humanConvergenceGuidance: [artifact("humanConvergenceGuidance:001", {
        targetRef: "convergenceFailure:001",
      })],
    },
    agentRuns: [
      {
        runId: "main-agent:initialization",
        role: "main",
        status: "succeeded",
        finishedAt: "2026-05-20T10:01:00.000Z",
      },
      {
        runId: "execution-agent:001",
        role: "execution",
        status: "succeeded",
        finishedAt: "2026-05-20T10:02:00.000Z",
      },
      {
        runId: "review-agent:001",
        role: "review",
        status: "succeeded",
        finishedAt: "2026-05-20T10:03:00.000Z",
      },
      {
        runId: "main-agent:convergence:001",
        role: "main",
        status: "succeeded",
        finishedAt: "2026-05-20T10:04:00.000Z",
      },
      {
        runId: "execution-agent:002",
        role: "execution",
        status: "failed",
        inputArtifactRefs: ["humanConvergenceGuidance:001"],
        finishedAt: "2026-05-20T10:05:00.000Z",
      },
    ],
    timeline: [
      { artifactType: "executionIntent", artifactId: "executionIntent", agentRunId: null, appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: "executionAuthorization", artifactId: "executionAuthorization", agentRunId: null, appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: "isolatedWorkspace", artifactId: "isolatedWorkspace", agentRunId: null, appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: null, artifactId: null, agentRunId: "main-agent:initialization", appendedAt: "2026-05-20T10:01:00.000Z" },
      { artifactType: "executionReport", artifactId: "executionReport:001", agentRunId: null, appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: null, artifactId: null, agentRunId: "execution-agent:001", appendedAt: "2026-05-20T10:02:00.000Z" },
      { artifactType: "reviewReport", artifactId: "reviewReport:001", agentRunId: null, appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: null, artifactId: null, agentRunId: "review-agent:001", appendedAt: "2026-05-20T10:03:00.000Z" },
      { artifactType: "convergenceFailure", artifactId: "convergenceFailure:001", agentRunId: null, appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: null, artifactId: null, agentRunId: "main-agent:convergence:001", appendedAt: "2026-05-20T10:04:00.000Z" },
      { artifactType: "humanDecisionRequest", artifactId: "humanDecisionRequest", agentRunId: null, appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: "humanConvergenceGuidance", artifactId: "humanConvergenceGuidance:001", agentRunId: null, appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: null, artifactId: null, agentRunId: "execution-agent:002", appendedAt: "2026-05-20T10:05:00.000Z" },
    ],
  };
}

test("builds an ordered stage trace and keeps repeated execution-agent nodes", () => {
  const timeline = buildStageTimeline(packageAfterHumanGuidance());

  assert.deepEqual(timeline.nodes.map((node) => node.stage), [
    "task-pool",
    "task-recommender",
    "execution-admission",
    "isolated-workspace",
    "main-agent",
    "execution-agent",
    "review-agent",
    "convergence",
    "human-decision",
    "execution-agent",
  ]);
  assert.equal(timeline.nodes.at(-1).stage, "execution-agent");
  assert.equal(timeline.nodes.at(-1).status, "current");
  assert.equal(timeline.nodes.at(-1).timestamp, "2026-05-20T10:05:00.000Z");
  assert.equal(timeline.nodes.at(-1).detail, "当前 · execution-agent:002");
  assert.equal(timeline.nodes.at(-2).stage, "human-decision");
  assert.equal(timeline.nodes.at(-2).detail, "humanDecisionRequest -> humanConvergenceGuidance:001");
  assert.equal(timeline.notes[0].kind, "feedback-loop");
  assert.match(timeline.notes[0].text, /humanConvergenceGuidance:001/);
});

test("adds the terminal stage after task closeout in the ordered trace", () => {
  const timeline = buildStageTimeline({
    packageId: "tasks-closed",
    currentWorkStage: "closed",
    artifacts: {
      autoMergeResult: artifact("autoMergeResult"),
      taskCloseout: artifact("taskCloseout", { finalStage: "closed" }),
    },
    timeline: [
      { artifactType: "autoMergeResult", artifactId: "autoMergeResult", agentRunId: null, appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: "taskCloseout", artifactId: "taskCloseout", agentRunId: null, appendedAt: "2026-05-20T10:00:00.000Z" },
    ],
  });

  assert.deepEqual(timeline.nodes.map((node) => node.stage), [
    "task-pool",
    "auto-merge-execution",
    "task-closeout",
    "closed",
  ]);
  assert.equal(timeline.nodes.at(-1).status, "current");
  assert.equal(timeline.nodes.at(-1).detail, "当前 · taskCloseout");
});
