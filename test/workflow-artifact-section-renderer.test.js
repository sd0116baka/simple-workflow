import { test } from "node:test";
import assert from "node:assert/strict";
import { renderWorkflowArtifactSection } from "../public/workflow-artifact-section-renderer.js";
import { FakeElement, markerElement } from "./support/fake-dom.js";

function createElements() {
  return {
    status: new FakeElement("span"),
    inputs: new FakeElement("div"),
    raw: new FakeElement("pre"),
    panel: new FakeElement("div"),
  };
}

function createOverviewRenderer(calls = []) {
  return {
    renderInputs(element, inputs) {
      calls.push(inputs);
      element.textContent = inputs.map((input) => `${input.label}=${input.value}`).join("|");
    },
  };
}

test("workflow artifact section renderer delegates concrete panel rendering", () => {
  const elements = createElements();
  const inputCalls = [];
  const taskContextPackage = { packageId: "task-context-package:tasks/task-001.yaml" };

  const rendered = renderWorkflowArtifactSection({
    elements,
    taskContextPackage,
    viewModel: {
      statusText: "已接受收敛成功",
      rawObject: { humanDecision: { decision: "accept-convergence" } },
      inputs: [{ label: "当前环节", value: "human-decision" }],
      panel: { kind: "humanDecision" },
      text: "fallback text",
    },
    workflowOverviewRenderers: createOverviewRenderer(inputCalls),
    workflowPanelRenderers: {
      appendWorkflowSectionPanel(element, panel, receivedPackage) {
        assert.equal(panel.kind, "humanDecision");
        assert.equal(receivedPackage, taskContextPackage);
        element.append(markerElement(`panel:${panel.kind}`));
        return true;
      },
    },
  });

  assert.equal(rendered, true);
  assert.equal(elements.status.textContent, "已接受收敛成功");
  assert.match(elements.raw.textContent, /accept-convergence/);
  assert.equal(elements.inputs.textContent, "当前环节=human-decision");
  assert.equal(elements.panel.textContent, "panel:humanDecision");
  assert.deepEqual(inputCalls, [[{ label: "当前环节", value: "human-decision" }]]);
});

test("workflow artifact section renderer falls back to text panel", () => {
  const elements = createElements();
  elements.panel.append(markerElement("stale"));

  const rendered = renderWorkflowArtifactSection({
    elements,
    taskContextPackage: null,
    viewModel: {
      statusText: "等待收敛结果",
      rawObject: { humanDecisionRequest: null },
      inputs: [{ label: "当前环节", value: "未生成" }],
      panel: null,
      text: "等待收敛成功证据。",
    },
    workflowOverviewRenderers: createOverviewRenderer(),
    workflowPanelRenderers: {
      appendWorkflowSectionPanel() {
        return false;
      },
    },
  });

  assert.equal(rendered, false);
  assert.equal(elements.status.textContent, "等待收敛结果");
  assert.match(elements.raw.textContent, /"humanDecisionRequest": null/);
  assert.equal(elements.inputs.textContent, "当前环节=未生成");
  assert.equal(elements.panel.textContent, "等待收敛成功证据。");
});
