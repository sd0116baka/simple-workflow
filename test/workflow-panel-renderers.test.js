import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPanelRenderers } from "../public/workflow-panel-renderers.js";
import {
  createFakeDocument,
  FakeElement,
  findAll,
} from "./support/fake-dom.js";

function guidablePackage() {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "human-decision",
    taskDraft: { id: "task-001", name: "测试任务" },
    source: { path: "tasks/task-001.yaml" },
    artifacts: {
      convergenceFailure: [
        {
          artifactId: "convergenceFailure:001",
          body: { reasonCode: "max-iterations-reached" },
        },
      ],
      humanDecisionRequest: {
        artifactId: "humanDecisionRequest",
        body: {
          targetRef: "convergenceFailure:001",
          decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
        },
      },
    },
    agentRuns: [],
    timeline: [],
  };
}

test("workflow panel renderers render recommendation intent", () => {
  const renderers = createWorkflowPanelRenderers({
    documentRef: createFakeDocument(),
  });

  const panel = renderers.createIntentPanel({
    recommendedPackageId: "task-context-package:tasks/task-001.yaml",
    confidence: 0.8,
    executionBrief: { goalInterpretation: "实现任务池过滤" },
    selectionReasoning: ["优先级最高"],
    candidateComparison: [
      { packageId: "task-001", decision: "selected" },
    ],
  });

  assert.equal(panel.className, "recommendation-intent");
  assert.match(panel.textContent, /task-context-package:tasks\/task-001\.yaml/);
  assert.match(panel.textContent, /推荐置信度：0.8/);
  assert.match(panel.textContent, /candidateComparison: task-001:selected/);
});

test("workflow panel renderers render stage timeline nodes and notes", () => {
  const renderers = createWorkflowPanelRenderers({
    documentRef: createFakeDocument(),
  });

  const panel = renderers.createStageTimelinePanel({
    nodes: [
      {
        className: "stage-node current",
        indexText: "01",
        label: "执行",
        stage: "execution-agent",
        timestampText: "10:00",
        detail: "execution-agent:001",
      },
    ],
    transitions: [
      {
        className: "stage-transition",
        iconText: "->",
        label: "进入审查",
      },
    ],
    notes: ["人工意见已进入下一轮执行"],
  });

  assert.equal(panel.className, "stage-timeline-frame");
  assert.match(panel.textContent, /执行/);
  assert.match(panel.textContent, /进入审查/);
  assert.match(panel.textContent, /人工意见已进入下一轮执行/);
});

test("workflow panel renderers wire human guidance actions through injected callbacks", async () => {
  const calls = [];
  const renderers = createWorkflowPanelRenderers({
    documentRef: createFakeDocument(),
    onContinueConvergenceWithGuidance: async (payload) => {
      calls.push(payload);
    },
    onAcceptConvergence: async () => {},
    onCancelTask: async () => {},
  });

  const panel = renderers.appendWorkflowSectionPanel(
    new FakeElement("div"),
    { kind: "humanDecision" },
    guidablePackage(),
  );
  assert.equal(panel, true);

  const container = new FakeElement("div");
  renderers.appendWorkflowSectionPanel(container, { kind: "humanDecision" }, guidablePackage());
  const textareas = findAll(container, (element) => element.tagName === "textarea");
  textareas.find((item) => item.dataset.field === "guidance").value = "请聚焦验收标准";
  textareas.find((item) => item.dataset.field === "expectedNextOutcome").value = "看到测试通过";

  const continueButton = findAll(
    container,
    (element) => element.tagName === "button" && element.textContent === "带意见继续收敛",
  )[0];
  continueButton.click();
  await Promise.resolve();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].guidance, "请聚焦验收标准");
  assert.equal(calls[0].expectedNextOutcome, "看到测试通过");
  assert.equal(calls[0].actionButton, continueButton);
});
