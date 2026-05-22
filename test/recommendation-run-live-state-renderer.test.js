import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRecommendationRunLiveState } from "../public/recommendation-run-live-state-renderer.js";
import { fakeElements } from "./support/fake-dom.js";
import { createRunningRecommendationRunFixture } from "./support/recommendation-run-fixtures.js";

function createElements(names = []) {
  return fakeElements([
    "recommendationRaw",
    "recommendationTerminal",
    "admissionRaw",
    "recommendationInputs",
    "admissionInputs",
    "runRecommendationButton",
    "cancelRecommendationButton",
    ...names,
  ]);
}

test("recommendation run live state renderer writes raw output, terminal, inputs, and controls", () => {
  const elements = createElements();
  const renderInputsCalls = [];

  renderRecommendationRunLiveState({
    elements,
    recommendationRun: createRunningRecommendationRunFixture({
      id: "recommendation-run:001",
      args: ["run", "--format", "json"],
      progress: [
        {
          at: "2026-05-21T01:02:03.000Z",
          stream: "stdout",
          terminalLine: "\u001b[32mhello\u001b[0m",
        },
      ],
      executionIntentAppendRequest: {
        artifactType: "executionIntent",
        artifact: { recommendedPackageId: "task-context-package:tasks/task-001.yaml" },
      },
    }),
    viewModel: {
      rawText: "{\n  \"status\": \"running\"\n}",
      recommendationInputs: [{ label: "prompt", value: "recommender" }],
      admissionInputs: [{ label: "任务池", value: "1 个条目" }],
      controls: {
        runDisabled: true,
        cancelHidden: false,
        cancelDisabled: false,
        cancelText: "取消运行",
      },
    },
    workflowOverviewRenderers: {
      renderInputs(element, inputs) {
        renderInputsCalls.push(inputs);
        element.textContent = inputs.map((input) => `${input.label}=${input.value}`).join("|");
      },
    },
  });

  assert.equal(elements.recommendationRaw.textContent, "{\n  \"status\": \"running\"\n}");
  assert.match(elements.recommendationTerminal.textContent, /recommendation-run:001/);
  assert.match(elements.recommendationTerminal.textContent, /\[stdout\] hello/);
  assert.equal(elements.recommendationTerminal.scrollTop, elements.recommendationTerminal.scrollHeight);
  assert.match(elements.admissionRaw.textContent, /executionIntent/);
  assert.equal(elements.recommendationInputs.textContent, "prompt=recommender");
  assert.equal(elements.admissionInputs.textContent, "任务池=1 个条目");
  assert.equal(elements.runRecommendationButton.disabled, true);
  assert.equal(elements.cancelRecommendationButton.hidden, false);
  assert.equal(elements.cancelRecommendationButton.disabled, false);
  assert.equal(elements.cancelRecommendationButton.textContent, "取消运行");
  assert.deepEqual(renderInputsCalls, [
    [{ label: "prompt", value: "recommender" }],
    [{ label: "任务池", value: "1 个条目" }],
  ]);
});

test("recommendation run live state renderer tolerates optional terminal and cancel controls", () => {
  const elements = createElements();
  delete elements.recommendationTerminal;
  delete elements.cancelRecommendationButton;

  assert.doesNotThrow(() => renderRecommendationRunLiveState({
    elements,
    recommendationRun: null,
    viewModel: {
      rawText: "尚未运行。",
      recommendationInputs: [],
      admissionInputs: [],
      controls: {
        runDisabled: false,
        cancelHidden: true,
        cancelDisabled: true,
        cancelText: "取消运行",
      },
    },
    workflowOverviewRenderers: {
      renderInputs(element, inputs) {
        element.textContent = `${inputs.length}`;
      },
    },
  }));

  assert.equal(elements.recommendationRaw.textContent, "尚未运行。");
  assert.equal(elements.admissionRaw.textContent, "未生成。");
  assert.equal(elements.recommendationInputs.textContent, "0");
  assert.equal(elements.admissionInputs.textContent, "0");
  assert.equal(elements.runRecommendationButton.disabled, false);
});
