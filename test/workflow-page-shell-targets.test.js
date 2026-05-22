import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowPageCommandTargets,
  createWorkflowPageErrorTargets,
} from "../public/workflow-page-shell-targets.js";

function createElements() {
  return Object.fromEntries([
    "selectedTitle",
    "selectedMeta",
    "rawText",
    "parsedText",
    "validationResult",
    "startupCheckPanel",
    "parseStatus",
    "validationStatus",
    "startupCheckStatus",
    "recommendationStatus",
    "humanDecisionStatus",
    "recommendationResult",
    "runRecommendationButton",
    "seedStateFixturesButton",
    "cleanupStateFixturesButton",
    "cancelRecommendationButton",
    "restartButton",
    "refreshButton",
    "seedStateFixtureSelect",
    "autoMergeStatus",
  ].map((name) => [name, { name }]));
}

test("workflow page shell targets expose the global error renderer target group", () => {
  const elements = createElements();

  assert.deepEqual(createWorkflowPageErrorTargets(elements), {
    selectedTitle: elements.selectedTitle,
    selectedMeta: elements.selectedMeta,
    rawText: elements.rawText,
    parsedText: elements.parsedText,
    validationResult: elements.validationResult,
    startupCheckPanel: elements.startupCheckPanel,
    parseStatus: elements.parseStatus,
    validationStatus: elements.validationStatus,
    startupCheckStatus: elements.startupCheckStatus,
    recommendationStatus: elements.recommendationStatus,
    humanDecisionStatus: elements.humanDecisionStatus,
    recommendationResult: elements.recommendationResult,
    runRecommendationButton: elements.runRecommendationButton,
    seedStateFixturesButton: elements.seedStateFixturesButton,
    cleanupStateFixturesButton: elements.cleanupStateFixturesButton,
    cancelRecommendationButton: elements.cancelRecommendationButton,
  });
});

test("workflow page shell targets expose the command target group", () => {
  const elements = createElements();

  assert.deepEqual(createWorkflowPageCommandTargets(elements), {
    restartButton: elements.restartButton,
    refreshButton: elements.refreshButton,
    seedStateFixtureSelect: elements.seedStateFixtureSelect,
    seedStateFixturesButton: elements.seedStateFixturesButton,
    cleanupStateFixturesButton: elements.cleanupStateFixturesButton,
    runRecommendationButton: elements.runRecommendationButton,
    cancelRecommendationButton: elements.cancelRecommendationButton,
    recommendationStatus: elements.recommendationStatus,
    recommendationResult: elements.recommendationResult,
    humanDecisionStatus: elements.humanDecisionStatus,
    autoMergeStatus: elements.autoMergeStatus,
  });
});
