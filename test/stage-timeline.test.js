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
  };
}

test("builds a full stage timeline and marks human-guided execution as current", () => {
  const timeline = buildStageTimeline(packageAfterHumanGuidance());
  const byStage = Object.fromEntries(timeline.nodes.map((node) => [node.stage, node]));

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
    "auto-merge-planning",
    "auto-merge-execution",
    "merged",
    "task-closeout",
    "closed",
    "cancelled",
  ]);
  assert.equal(byStage["execution-agent"].status, "current");
  assert.equal(byStage["execution-agent"].timestamp, "2026-05-20T10:05:00.000Z");
  assert.equal(byStage["execution-agent"].detail, "当前 · executionReport:001");
  assert.equal(byStage["human-decision"].status, "completed");
  assert.equal(byStage["human-decision"].detail, "humanConvergenceGuidance:001");
  assert.equal(byStage["human-decision"].timestamp, "2026-05-20T10:00:00.000Z");
  assert.equal(byStage["auto-merge-planning"].status, "pending");
  assert.equal(byStage["auto-merge-planning"].timestamp, null);
  assert.equal(timeline.notes[0].kind, "feedback-loop");
  assert.match(timeline.notes[0].text, /humanConvergenceGuidance:001/);
});

test("marks closed and cancelled as alternative terminal branches", () => {
  const timeline = buildStageTimeline({
    packageId: "tasks-closed",
    currentWorkStage: "closed",
    artifacts: {
      autoMergeResult: artifact("autoMergeResult"),
      taskCloseout: artifact("taskCloseout", { finalStage: "closed" }),
    },
  });
  const byStage = Object.fromEntries(timeline.nodes.map((node) => [node.stage, node]));

  assert.equal(byStage.closed.status, "current");
  assert.equal(byStage.cancelled.status, "skipped");
  assert.equal(byStage["task-closeout"].status, "completed");
});
