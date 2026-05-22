import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildStageTimelineSectionViewModel,
  formatStageTimestamp,
} from "../public/stage-timeline-section-view-model.js";

function artifact(artifactId, body = {}) {
  return { artifactId, body, appendedAt: "2026-05-20T10:00:00.000Z" };
}

test("stage timeline section view model renders the empty state", () => {
  assert.deepEqual(buildStageTimelineSectionViewModel(null), {
    statusText: "等待任务包",
    emptyText: "等待任务上下文包。",
    nodes: [],
    transitions: [],
    notes: [],
  });
});

test("stage timeline section view model formats node, transition, and note display state", () => {
  const viewModel = buildStageTimelineSectionViewModel({
    packageId: "tasks-demo",
    currentWorkStage: "execution-agent",
    fixture: { generatedAt: "2026-05-20T09:55:00.000Z" },
    artifacts: {
      executionIntent: artifact("executionIntent"),
      executionAuthorization: artifact("executionAuthorization"),
      isolatedWorkspace: artifact("isolatedWorkspace"),
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
    ],
    timeline: [
      { artifactType: "executionIntent", artifactId: "executionIntent", appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: "executionAuthorization", artifactId: "executionAuthorization", appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: "isolatedWorkspace", artifactId: "isolatedWorkspace", appendedAt: "2026-05-20T10:00:00.000Z" },
      { agentRunId: "main-agent:initialization", appendedAt: "2026-05-20T10:01:00.000Z" },
      { agentRunId: "execution-agent:001", appendedAt: "2026-05-20T10:02:00.000Z" },
      { artifactType: "convergenceFailure", artifactId: "convergenceFailure:001", appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: "humanDecisionRequest", artifactId: "humanDecisionRequest", appendedAt: "2026-05-20T10:00:00.000Z" },
      { artifactType: "humanConvergenceGuidance", artifactId: "humanConvergenceGuidance:001", appendedAt: "2026-05-20T10:00:00.000Z" },
    ],
  });

  assert.equal(viewModel.statusText, "Execution Agent · 8/8");
  assert.equal(viewModel.emptyText, null);
  assert.equal(viewModel.nodes[0].indexText, "01");
  assert.equal(viewModel.nodes[0].label, "任务池");
  assert.equal(viewModel.nodes[0].timestampText, "05/20 17:55:00");
  const currentNode = viewModel.nodes.find((node) => node.className === "stage-timeline-node current");
  assert.equal(currentNode.stage, "execution-agent");
  assert.equal(currentNode.detail, "当前 · execution-agent:001");
  assert.equal(viewModel.nodes.at(-1).detail, "humanDecisionRequest -> humanConvergenceGuidance:001");
  assert.equal(viewModel.transitions[0].iconText, "→");
  assert.equal(viewModel.transitions[0].className, "stage-timeline-connector completed");
  assert.match(viewModel.notes[0], /人工意见回环/);
});

test("stage timestamp formatter preserves special timestamp states", () => {
  assert.equal(formatStageTimestamp({ status: "skipped" }), "未进入");
  assert.equal(formatStageTimestamp({ status: "pending", timestamp: null }), "未发生");
  assert.equal(formatStageTimestamp({ status: "completed", timestamp: null }), "无时间");
  assert.equal(formatStageTimestamp({ status: "completed", timestamp: "not-a-date" }), "not-a-date");
});

test("stage timeline section view model ignores malformed single closeout arrays", () => {
  const viewModel = buildStageTimelineSectionViewModel({
    packageId: "tasks-demo",
    currentWorkStage: "closed",
    artifacts: {
      taskCloseout: [
        artifact("taskCloseout", { finalStage: "closed" }),
      ],
    },
    timeline: [],
  });

  assert.equal(viewModel.nodes.at(-1).stage, "closed");
  assert.equal(viewModel.nodes.at(-1).detail, "当前 · closed");
  assert.equal(viewModel.nodes.filter((node) => node.detail === "taskCloseout").length, 0);
});
