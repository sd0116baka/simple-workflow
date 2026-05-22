import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowPageErrorRenderer,
  renderWorkflowPageError,
} from "../public/workflow-page-error-renderer.js";

function element({ textContent = "old", disabled = true } = {}) {
  return { textContent, disabled };
}

function createElements() {
  return {
    selectedTitle: element(),
    selectedMeta: element(),
    rawText: element(),
    parsedText: element(),
    validationResult: element(),
    startupCheckPanel: element(),
    parseStatus: element(),
    validationStatus: element(),
    startupCheckStatus: element(),
    recommendationStatus: element(),
    humanDecisionStatus: element(),
    recommendationResult: element(),
    runRecommendationButton: element({ disabled: true }),
    seedStateFixturesButton: element({ textContent: "生成中", disabled: true }),
    cleanupStateFixturesButton: element({ textContent: "清理中", disabled: true }),
    cancelRecommendationButton: element({ textContent: "取消中", disabled: true }),
  };
}

test("workflow page error renderer writes failure state and restores controls", () => {
  const elements = createElements();

  renderWorkflowPageError({
    elements,
    error: new Error("读取任务失败"),
  });

  assert.equal(elements.selectedTitle.textContent, "读取失败");
  assert.equal(elements.selectedMeta.textContent, "请查看服务端日志。");
  assert.equal(elements.rawText.textContent, "读取任务失败");
  assert.equal(elements.parsedText.textContent, "");
  assert.equal(elements.validationResult.textContent, "");
  assert.equal(elements.startupCheckPanel.textContent, "");
  assert.equal(elements.parseStatus.textContent, "失败");
  assert.equal(elements.validationStatus.textContent, "失败");
  assert.equal(elements.startupCheckStatus.textContent, "失败");
  assert.equal(elements.recommendationStatus.textContent, "失败");
  assert.equal(elements.humanDecisionStatus.textContent, "失败");
  assert.equal(elements.recommendationResult.textContent, "读取任务失败");
  assert.equal(elements.runRecommendationButton.disabled, false);
  assert.deepEqual(elements.seedStateFixturesButton, {
    textContent: "生成状态桩",
    disabled: false,
  });
  assert.deepEqual(elements.cleanupStateFixturesButton, {
    textContent: "清理状态桩",
    disabled: false,
  });
  assert.deepEqual(elements.cancelRecommendationButton, {
    textContent: "取消运行",
    disabled: false,
  });
});

test("workflow page error renderer tolerates optional elements", () => {
  const elements = createElements();
  elements.parsedText = null;
  elements.validationResult = null;
  elements.validationStatus = null;
  elements.humanDecisionStatus = null;
  elements.recommendationResult = null;
  elements.seedStateFixturesButton = null;
  elements.cleanupStateFixturesButton = null;
  elements.cancelRecommendationButton = null;

  renderWorkflowPageError({ elements, error: "plain failure" });

  assert.equal(elements.rawText.textContent, "plain failure");
  assert.equal(elements.runRecommendationButton.disabled, false);
});

test("workflow page error renderer factory closes over elements", () => {
  const elements = createElements();
  const renderer = createWorkflowPageErrorRenderer({ elements });

  renderer.render(new Error("boom"));

  assert.equal(elements.rawText.textContent, "boom");
  assert.equal(elements.recommendationStatus.textContent, "失败");
});
