import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRecommendationRunTaskContext } from "../public/recommendation-run-task-context-renderer.js";
import { fakeElements, markerElement } from "./support/fake-dom.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

function createElements() {
  return fakeElements([
    "taskContextPackageStatus",
    "taskContextPackageRaw",
    "taskContextPackagePanel",
  ]);
}

test("recommendation run task context renderer renders package raw, label, and panel", () => {
  const elements = createElements();

  renderRecommendationRunTaskContext({
    elements,
    taskContextPackage: createTaskContextPackageFixture(),
    workflowPanelRenderers: {
      createTaskContextPackagePanel(taskContextPackage) {
        return markerElement(`package:${taskContextPackage.packageId}`);
      },
    },
  });

  assert.equal(elements.taskContextPackageStatus.textContent, "task-001.yaml · execution-agent");
  assert.match(elements.taskContextPackageRaw.textContent, /"packageId": "task-context-package:tasks\/task-001.yaml"/);
  assert.match(elements.taskContextPackagePanel.textContent, /package:task-context-package:tasks\/task-001.yaml/);
});

test("recommendation run task context renderer renders injected empty state", () => {
  const elements = createElements();

  renderRecommendationRunTaskContext({
    elements,
    taskContextPackage: null,
    workflowPanelRenderers: {
      createTaskContextPackagePanel() {
        throw new Error("should not render package panel");
      },
    },
    emptyState: {
      taskContextPackageStatus: "等待输入",
      taskContextPackageRaw: "等待执行准入器输出。",
      taskContextPackagePanel: "等待执行准入器输出。",
    },
  });

  assert.equal(elements.taskContextPackageStatus.textContent, "等待输入");
  assert.equal(elements.taskContextPackageRaw.textContent, "等待执行准入器输出。");
  assert.equal(elements.taskContextPackagePanel.textContent, "等待执行准入器输出。");
});

test("recommendation run task context renderer renders missing package fallback", () => {
  const elements = createElements();

  renderRecommendationRunTaskContext({
    elements,
    taskContextPackage: null,
    workflowPanelRenderers: {
      createTaskContextPackagePanel() {
        throw new Error("should not render package panel");
      },
    },
  });

  assert.equal(elements.taskContextPackageStatus.textContent, "未生成");
  assert.equal(elements.taskContextPackageRaw.textContent, "尚未生成任务上下文包。");
  assert.equal(elements.taskContextPackagePanel.textContent, "尚未生成任务上下文包快照。");
});
