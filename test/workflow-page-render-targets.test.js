import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRecommendationRunRenderTargets,
  createWorkflowSectionRenderTargets,
} from "../public/workflow-page-render-targets.js";

function createElements() {
  const elements = {};
  for (const name of [
    "recommendationResult",
    "recommendationIntentPanel",
    "admissionPanel",
    "taskContextPackagePanel",
    "taskContextPackageRaw",
    "recommendationRaw",
    "recommendationTerminal",
    "admissionRaw",
    "recommendationInputs",
    "admissionInputs",
    "runRecommendationButton",
    "cancelRecommendationButton",
    "recommendationStatus",
    "admissionStatus",
    "taskContextPackageStatus",
    "humanDecisionStatus",
    "humanDecisionInputs",
    "humanDecisionRaw",
    "humanDecisionPanel",
    "autoMergeStatus",
    "autoMergeInputs",
    "autoMergeRaw",
    "autoMergePanel",
    "autoMergeExecutionStatus",
    "autoMergeExecutionInputs",
    "autoMergeExecutionRaw",
    "autoMergeExecutionPanel",
    "taskCloseoutStatus",
    "taskCloseoutInputs",
    "taskCloseoutRaw",
    "taskCloseoutPanel",
    "stageTimelineStatus",
    "stageTimelinePanel",
  ]) {
    elements[name] = { name };
  }
  return elements;
}

test("workflow page render targets group workflow section elements", () => {
  const elements = createElements();
  const targets = createWorkflowSectionRenderTargets(elements);

  assert.deepEqual(Object.keys(targets), [
    "humanDecision",
    "autoMerge",
    "autoMergeExecution",
    "taskCloseout",
    "stageTimeline",
  ]);
  assert.equal(targets.humanDecision.status, elements.humanDecisionStatus);
  assert.equal(targets.humanDecision.inputs, elements.humanDecisionInputs);
  assert.equal(targets.autoMerge.raw, elements.autoMergeRaw);
  assert.equal(targets.autoMergeExecution.panel, elements.autoMergeExecutionPanel);
  assert.equal(targets.taskCloseout.inputs, elements.taskCloseoutInputs);
  assert.equal(targets.stageTimeline.status, elements.stageTimelineStatus);
  assert.equal(targets.stageTimeline.panel, elements.stageTimelinePanel);
});

test("workflow page render targets group recommendation run elements", () => {
  const elements = createElements();
  const targets = createRecommendationRunRenderTargets(elements);

  assert.equal(targets.recommendationResult, elements.recommendationResult);
  assert.equal(targets.recommendationTerminal, elements.recommendationTerminal);
  assert.equal(targets.runRecommendationButton, elements.runRecommendationButton);
  assert.equal(targets.cancelRecommendationButton, elements.cancelRecommendationButton);
  assert.equal(targets.taskContextPackagePanel, elements.taskContextPackagePanel);
  assert.equal(targets.humanDecisionStatus, elements.humanDecisionStatus);
  assert.equal(targets.autoMergeExecutionRaw, elements.autoMergeExecutionRaw);
  assert.equal(targets.taskCloseoutPanel, elements.taskCloseoutPanel);
  assert.equal(Object.keys(targets).length, 27);
});
