import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleStageTimelineNodes } from "../public/stage-timeline-node-assembly.js";

function timelineNode(stage, evidence = stage) {
  return {
    stage,
    label: stage,
    transition: `${stage}:transition`,
    evidence,
    timestamp: null,
    status: "completed",
    detail: evidence,
  };
}

function artifact(artifactId, body = {}) {
  return { artifactId, body, appendedAt: "2026-05-20T10:00:00.000Z" };
}

test("stage timeline node assembly adds initial node and marks the latest matching current stage", () => {
  const { nodes, transitions } = assembleStageTimelineNodes({
    taskContextPackage: {
      packageId: "tasks-demo",
      currentWorkStage: "execution-agent",
      fixture: { generatedAt: "2026-05-20T09:55:00.000Z" },
    },
    timelineNodes: [
      timelineNode("execution-agent", "execution-agent:001"),
      timelineNode("human-decision", "humanDecisionRequest -> humanConvergenceGuidance:001"),
      timelineNode("execution-agent", "execution-agent:002"),
    ],
  });

  assert.deepEqual(nodes.map((node) => node.stage), [
    "task-pool",
    "execution-agent",
    "human-decision",
    "execution-agent",
  ]);
  assert.equal(nodes[0].timestamp, "2026-05-20T09:55:00.000Z");
  assert.equal(nodes[1].status, "completed");
  assert.equal(nodes.at(-1).status, "current");
  assert.equal(nodes.at(-1).detail, "当前 · execution-agent:002");
  assert.deepEqual(transitions.map((transition) => [transition.from, transition.to]), [
    ["task-pool", "execution-agent"],
    ["execution-agent", "human-decision"],
    ["human-decision", "execution-agent"],
  ]);
});

test("stage timeline node assembly appends terminal node from closeout final stage", () => {
  const { nodes, transitions } = assembleStageTimelineNodes({
    taskContextPackage: {
      packageId: "tasks-closed",
      currentWorkStage: "closed",
      artifacts: {
        taskCloseout: artifact("taskCloseout", { finalStage: "closed" }),
      },
    },
    timelineNodes: [
      timelineNode("task-closeout", "taskCloseout"),
    ],
  });

  assert.deepEqual(nodes.map((node) => node.stage), [
    "task-pool",
    "task-closeout",
    "closed",
  ]);
  assert.equal(nodes.at(-1).status, "current");
  assert.equal(nodes.at(-1).detail, "当前 · taskCloseout");
  assert.equal(transitions.at(-1).from, "task-closeout");
  assert.equal(transitions.at(-1).to, "closed");
});

test("stage timeline node assembly adds fallback current node when no event reached current stage", () => {
  const { nodes } = assembleStageTimelineNodes({
    taskContextPackage: {
      packageId: "tasks-fallback",
      currentWorkStage: "auto-merge-planning",
    },
    timelineNodes: [
      timelineNode("human-decision", "humanDecision:001"),
    ],
  });

  assert.deepEqual(nodes.map((node) => node.stage), [
    "task-pool",
    "human-decision",
    "auto-merge-planning",
  ]);
  assert.equal(nodes.at(-1).status, "current");
  assert.equal(nodes.at(-1).detail, "当前 · auto-merge-planning");
});
