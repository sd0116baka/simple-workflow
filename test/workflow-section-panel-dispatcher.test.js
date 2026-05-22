import { test } from "node:test";
import assert from "node:assert/strict";
import { appendWorkflowSectionPanel } from "../public/workflow-section-panel-dispatcher.js";
import {
  FakeElement,
  markerElement,
} from "./support/fake-dom.js";

function createPanelRenderers(calls) {
  return {
    createHumanDecisionPanel(taskContextPackage) {
      calls.push(["humanDecision", taskContextPackage.packageId]);
      return markerElement("humanDecision");
    },
    createAutoMergePanel(taskContextPackage) {
      calls.push(["autoMergePlan", taskContextPackage.packageId]);
      return markerElement("autoMergePlan");
    },
    createAutoMergeExecutionPanel(taskContextPackage) {
      calls.push(["autoMergeExecution", taskContextPackage.packageId]);
      return markerElement("autoMergeExecution");
    },
    createTaskCloseoutPanel(taskContextPackage) {
      calls.push(["taskCloseout", taskContextPackage.packageId]);
      return markerElement("taskCloseout");
    },
    createListPanel(viewModel) {
      calls.push(["list", viewModel.title]);
      return markerElement(`list:${viewModel.title}`);
    },
  };
}

test("workflow section panel dispatcher delegates known panel kinds", () => {
  const calls = [];
  const panelRenderers = createPanelRenderers(calls);
  const taskContextPackage = { packageId: "task-context-package:tasks/task-001.yaml" };
  const kinds = [
    { kind: "humanDecision" },
    { kind: "autoMergePlan" },
    { kind: "autoMergeExecution" },
    { kind: "taskCloseout" },
    { kind: "list", viewModel: { title: "合并计划已生成" } },
  ];
  const container = new FakeElement("div");

  for (const panel of kinds) {
    assert.equal(appendWorkflowSectionPanel(container, panel, taskContextPackage, panelRenderers), true);
  }

  assert.deepEqual(calls, [
    ["humanDecision", "task-context-package:tasks/task-001.yaml"],
    ["autoMergePlan", "task-context-package:tasks/task-001.yaml"],
    ["autoMergeExecution", "task-context-package:tasks/task-001.yaml"],
    ["taskCloseout", "task-context-package:tasks/task-001.yaml"],
    ["list", "合并计划已生成"],
  ]);
  assert.equal(
    container.textContent,
    "humanDecisionautoMergePlanautoMergeExecutiontaskCloseoutlist:合并计划已生成",
  );
});

test("workflow section panel dispatcher ignores empty and unknown panels", () => {
  const calls = [];
  const panelRenderers = createPanelRenderers(calls);
  const container = new FakeElement("div");
  const taskContextPackage = { packageId: "task-context-package:tasks/task-001.yaml" };

  assert.equal(appendWorkflowSectionPanel(container, null, taskContextPackage, panelRenderers), false);
  assert.equal(
    appendWorkflowSectionPanel(container, { kind: "unknown" }, taskContextPackage, panelRenderers),
    false,
  );

  assert.deepEqual(calls, []);
  assert.equal(container.textContent, "");
});
