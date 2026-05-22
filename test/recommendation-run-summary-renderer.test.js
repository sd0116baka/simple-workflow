import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRecommendationRunSummary } from "../public/recommendation-run-summary-renderer.js";
import {
  createFakeDocument,
  fakeElements,
  markerElement,
} from "./support/fake-dom.js";

function createElements() {
  return fakeElements([
    "recommendationStatus",
    "recommendationResult",
    "recommendationIntentPanel",
    "admissionStatus",
    "admissionPanel",
  ]);
}

function createPanelRenderers(calls) {
  return {
    createIntentPanel(intent) {
      calls.push(["intent", intent.recommendedPackageId]);
      return markerElement(`intent:${intent.recommendedPackageId}`);
    },
    createAdmissionPanel(admission) {
      calls.push(["admission", admission.appendRequest?.artifactType]);
      return markerElement(`admission:${admission.appendRequest?.artifactType}`);
    },
  };
}

test("recommendation run summary renderer renders intent, admission, and output", () => {
  const calls = [];
  const elements = createElements();
  renderRecommendationRunSummary({
    documentRef: createFakeDocument(),
    elements,
    recommendationRun: {
      executionIntent: {
        recommendedPackageId: "task-context-package:tasks/task-001.yaml",
      },
      executionAdmission: {
        appendRequest: { artifactType: "executionAuthorization" },
      },
    },
    viewModel: {
      recommendationStatus: "running · 00:03",
      summary: {
        className: "recommendation-summary running",
        text: "探针正在运行... 00:03",
      },
      metaText: "opencode run --format json",
      admissionStatus: "executionAuthorization",
      outputText: "运行进度\n启动推荐器",
    },
    workflowPanelRenderers: createPanelRenderers(calls),
  });

  assert.equal(elements.recommendationStatus.textContent, "running · 00:03");
  assert.match(elements.recommendationResult.textContent, /探针正在运行/);
  assert.match(elements.recommendationResult.textContent, /opencode run --format json/);
  assert.match(elements.recommendationResult.textContent, /intent:task-context-package:tasks\/task-001.yaml/);
  assert.match(elements.recommendationResult.textContent, /运行进度/);
  assert.match(elements.recommendationIntentPanel.textContent, /intent:task-context-package:tasks\/task-001.yaml/);
  assert.equal(elements.admissionStatus.textContent, "executionAuthorization");
  assert.match(elements.admissionPanel.textContent, /admission:executionAuthorization/);
  assert.deepEqual(calls, [
    ["intent", "task-context-package:tasks/task-001.yaml"],
    ["intent", "task-context-package:tasks/task-001.yaml"],
    ["admission", "executionAuthorization"],
  ]);
});

test("recommendation run summary renderer renders missing intent and admission text", () => {
  const calls = [];
  const elements = createElements();
  renderRecommendationRunSummary({
    documentRef: createFakeDocument(),
    elements,
    recommendationRun: {},
    viewModel: {
      recommendationStatus: "succeeded · 用时 00:04",
      summary: {
        className: "recommendation-summary succeeded",
        text: "exitCode: 0 · 用时 00:04",
      },
      metaText: "未启动外部命令",
      recommendationIntentText: "尚未解析出执行意图。",
      admissionStatus: "等待输入",
      admissionPanelText: "尚未计算执行授权。",
      outputText: "等待输出...",
    },
    workflowPanelRenderers: createPanelRenderers(calls),
  });

  assert.match(elements.recommendationResult.textContent, /exitCode: 0/);
  assert.match(elements.recommendationResult.textContent, /未启动外部命令/);
  assert.match(elements.recommendationResult.textContent, /等待输出/);
  assert.equal(elements.recommendationIntentPanel.textContent, "尚未解析出执行意图。");
  assert.equal(elements.admissionStatus.textContent, "等待输入");
  assert.equal(elements.admissionPanel.textContent, "尚未计算执行授权。");
  assert.deepEqual(calls, []);
});
