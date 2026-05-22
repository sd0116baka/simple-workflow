import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowSectionRenderer } from "../public/workflow-section-renderer.js";
import {
  FakeElement,
  markerElement,
} from "./support/fake-dom.js";

function createSectionElements() {
  const section = () => ({
    status: new FakeElement("span"),
    inputs: new FakeElement("div"),
    raw: new FakeElement("pre"),
    panel: new FakeElement("div"),
  });

  return {
    humanDecision: section(),
    autoMerge: section(),
    autoMergeExecution: section(),
    taskCloseout: section(),
    stageTimeline: {
      status: new FakeElement("span"),
      panel: new FakeElement("div"),
    },
  };
}

function createRendererHarness() {
  const panelKinds = [];
  const inputSnapshots = [];
  const renderer = createWorkflowSectionRenderer({
    workflowOverviewRenderers: {
      renderInputs(element, inputs) {
        inputSnapshots.push(inputs);
        element.textContent = inputs.map((input) => `${input.label}=${input.value}`).join("|");
      },
    },
    workflowPanelRenderers: {
      appendWorkflowSectionPanel(element, panel) {
        if (!panel) return false;
        panelKinds.push(panel.kind);
        element.append(markerElement(`panel:${panel.kind}`));
        return true;
      },
      createStageTimelinePanel(viewModel) {
        panelKinds.push("stageTimeline");
        return markerElement(`timeline:${viewModel.statusText}`);
      },
    },
  });

  return { renderer, panelKinds, inputSnapshots };
}

function artifact(artifactId, body = {}) {
  return { artifactId, body, appendedAt: "2026-05-21T10:00:00.000Z" };
}

function closedPackage() {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "closed",
    artifacts: {
      humanDecisionRequest: artifact("humanDecisionRequest:001", {
        targetType: "convergenceSuccess",
        targetRef: "convergenceSuccess:001",
      }),
      humanDecision: artifact("humanDecision:001", {
        targetType: "convergenceSuccess",
        targetRef: "convergenceSuccess:001",
        decision: "accept-convergence",
      }),
      autoMergePlan: artifact("autoMergePlan:001", {
        changeSet: { changedFiles: ["src/example.js"] },
      }),
      autoMergeResult: artifact("autoMergeResult:001"),
      taskCloseout: artifact("taskCloseout:001", { finalStage: "closed" }),
    },
    agentRuns: [],
    timeline: [
      { artifactType: "humanDecisionRequest", artifactId: "humanDecisionRequest:001", appendedAt: "2026-05-21T10:00:00.000Z" },
      { artifactType: "humanDecision", artifactId: "humanDecision:001", appendedAt: "2026-05-21T10:01:00.000Z" },
      { artifactType: "autoMergePlan", artifactId: "autoMergePlan:001", appendedAt: "2026-05-21T10:02:00.000Z" },
      { artifactType: "autoMergeResult", artifactId: "autoMergeResult:001", appendedAt: "2026-05-21T10:03:00.000Z" },
      { artifactType: "taskCloseout", artifactId: "taskCloseout:001", appendedAt: "2026-05-21T10:04:00.000Z" },
    ],
  };
}

test("workflow section renderer renders empty workflow sections", () => {
  const { renderer, panelKinds, inputSnapshots } = createRendererHarness();
  const elements = createSectionElements();

  renderer.renderAll({ elements, taskContextPackage: null });

  assert.equal(elements.humanDecision.status.textContent, "等待收敛结果");
  assert.equal(elements.humanDecision.panel.textContent, "等待收敛成功证据。");
  assert.match(elements.humanDecision.raw.textContent, /"humanDecisionRequest": null/);
  assert.match(elements.autoMerge.inputs.textContent, /当前环节=未生成/);
  assert.equal(elements.autoMerge.panel.textContent, "等待人工接受收敛成功。");
  assert.equal(elements.autoMergeExecution.panel.textContent, "等待自动合并计划。");
  assert.equal(elements.taskCloseout.panel.textContent, "等待自动合并结果。");
  assert.equal(elements.stageTimeline.status.textContent, "等待任务包");
  assert.equal(elements.stageTimeline.panel.textContent, "等待任务上下文包。");
  assert.equal(inputSnapshots.length, 4);
  assert.deepEqual(panelKinds, []);
});

test("workflow section renderer delegates artifact panels and timeline panel", () => {
  const { renderer, panelKinds } = createRendererHarness();
  const elements = createSectionElements();

  renderer.renderAll({ elements, taskContextPackage: closedPackage() });

  assert.equal(elements.humanDecision.status.textContent, "已接受收敛成功");
  assert.match(elements.humanDecision.raw.textContent, /humanDecisionRequest:001/);
  assert.equal(elements.humanDecision.panel.textContent, "panel:humanDecision");
  assert.equal(elements.autoMerge.status.textContent, "已完成");
  assert.equal(elements.autoMerge.panel.textContent, "panel:autoMergePlan");
  assert.equal(elements.autoMergeExecution.status.textContent, "已合并");
  assert.equal(elements.autoMergeExecution.panel.textContent, "panel:autoMergeExecution");
  assert.equal(elements.taskCloseout.status.textContent, "已关闭");
  assert.equal(elements.taskCloseout.panel.textContent, "panel:taskCloseout");
  assert.match(elements.stageTimeline.panel.textContent, /timeline:/);
  assert.deepEqual(panelKinds, [
    "humanDecision",
    "autoMergePlan",
    "autoMergeExecution",
    "taskCloseout",
    "stageTimeline",
  ]);
});
