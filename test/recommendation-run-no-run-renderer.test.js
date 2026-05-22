import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRecommendationRunNoRunState } from "../public/recommendation-run-no-run-renderer.js";
import { fakeElements, markerElement } from "./support/fake-dom.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

function createElements() {
  return fakeElements([
    "recommendationStatus",
    "admissionStatus",
    "recommendationResult",
    "recommendationIntentPanel",
    "admissionPanel",
    "taskContextPackageStatus",
    "taskContextPackageRaw",
    "taskContextPackagePanel",
    "humanDecisionStatus",
    "humanDecisionRaw",
    "humanDecisionPanel",
    "autoMergeStatus",
    "autoMergeRaw",
    "autoMergePanel",
    "autoMergeExecutionStatus",
    "autoMergeExecutionRaw",
    "autoMergeExecutionPanel",
    "taskCloseoutStatus",
    "taskCloseoutRaw",
    "taskCloseoutPanel",
  ]);
}

function createViewModel() {
  return {
    recommendationStatus: "未运行",
    admissionStatus: "等待输入",
    recommendationResultText: "尚未触发推荐器。",
    recommendationIntentText: "尚未解析。",
    admissionPanelText: "等待推荐器输出。",
  };
}

test("recommendation run no-run renderer writes default downstream empty state", () => {
  const elements = createElements();

  const emptyState = renderRecommendationRunNoRunState({
    elements,
    viewModel: createViewModel(),
    taskContextPackage: null,
    workflowPanelRenderers: {
      createTaskContextPackagePanel() {
        throw new Error("should not render package panel");
      },
    },
  });

  assert.equal(emptyState.humanDecisionPanel, "等待收敛成功证据。");
  assert.equal(elements.recommendationStatus.textContent, "未运行");
  assert.equal(elements.recommendationResult.textContent, "尚未触发推荐器。");
  assert.equal(elements.recommendationIntentPanel.textContent, "尚未解析。");
  assert.equal(elements.admissionPanel.textContent, "等待推荐器输出。");
  assert.equal(elements.taskContextPackageStatus.textContent, "等待输入");
  assert.equal(elements.taskContextPackageRaw.textContent, "等待执行准入器输出。");
  assert.equal(elements.taskContextPackagePanel.textContent, "等待执行准入器输出。");
  assert.equal(elements.humanDecisionStatus.textContent, "等待输入");
  assert.equal(elements.autoMergePanel.textContent, "等待人工接受收敛成功。");
  assert.equal(elements.autoMergeExecutionPanel.textContent, "等待合并计划。");
  assert.equal(elements.taskCloseoutPanel.textContent, "等待自动合并结果。");
});

test("recommendation run no-run renderer keeps task package panel when one is already active", () => {
  const elements = createElements();

  renderRecommendationRunNoRunState({
    elements,
    viewModel: createViewModel(),
    taskContextPackage: createTaskContextPackageFixture(),
    workflowPanelRenderers: {
      createTaskContextPackagePanel(taskContextPackage) {
        return markerElement(`package:${taskContextPackage.packageId}`);
      },
    },
  });

  assert.equal(elements.recommendationStatus.textContent, "未运行");
  assert.equal(elements.taskContextPackageStatus.textContent, "task-001.yaml · execution-agent");
  assert.match(elements.taskContextPackageRaw.textContent, /"packageId": "task-context-package:tasks\/task-001.yaml"/);
  assert.match(elements.taskContextPackagePanel.textContent, /package:task-context-package:tasks\/task-001.yaml/);
  assert.equal(elements.humanDecisionPanel.textContent, "");
  assert.equal(elements.autoMergePanel.textContent, "");
  assert.equal(elements.taskCloseoutPanel.textContent, "");
});
