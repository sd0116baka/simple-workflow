import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowPageCommandTargets,
  createWorkflowPageErrorTargets,
  createWorkflowPageTerminalTargets,
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
    "runWorkflowButton",
    "seedStateFixturesButton",
    "cleanupStateFixturesButton",
    "cancelRecommendationButton",
    "restartButton",
    "refreshButton",
    "seedStateFixtureSelect",
    "autoMergeStatus",
    "taskDraftStatus",
    "taskDraftMessages",
    "taskDraftInput",
    "taskDraftDiscussButton",
    "taskDraftFinalizeButton",
    "taskDraftCreateButton",
    "taskDraftValidation",
    "taskDraftOutput",
    "terminalStatus",
    "terminalCommandInput",
    "terminalArgsInput",
    "terminalStartButton",
    "terminalCancelButton",
    "terminalOutput",
    "terminalInput",
    "terminalSendButton",
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
    runWorkflowButton: elements.runWorkflowButton,
    seedStateFixturesButton: elements.seedStateFixturesButton,
    cleanupStateFixturesButton: elements.cleanupStateFixturesButton,
    cancelRecommendationButton: elements.cancelRecommendationButton,
    terminalStatus: elements.terminalStatus,
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
    runWorkflowButton: elements.runWorkflowButton,
    cancelRecommendationButton: elements.cancelRecommendationButton,
    recommendationStatus: elements.recommendationStatus,
    recommendationResult: elements.recommendationResult,
    humanDecisionStatus: elements.humanDecisionStatus,
    autoMergeStatus: elements.autoMergeStatus,
    taskDraftStatus: elements.taskDraftStatus,
    taskDraftMessages: elements.taskDraftMessages,
    taskDraftInput: elements.taskDraftInput,
    taskDraftDiscussButton: elements.taskDraftDiscussButton,
    taskDraftFinalizeButton: elements.taskDraftFinalizeButton,
    taskDraftCreateButton: elements.taskDraftCreateButton,
    taskDraftValidation: elements.taskDraftValidation,
    taskDraftOutput: elements.taskDraftOutput,
    terminalCommandInput: elements.terminalCommandInput,
    terminalArgsInput: elements.terminalArgsInput,
    terminalStartButton: elements.terminalStartButton,
    terminalCancelButton: elements.terminalCancelButton,
    terminalInput: elements.terminalInput,
    terminalSendButton: elements.terminalSendButton,
  });
});

test("workflow page shell targets expose the terminal target group", () => {
  const elements = createElements();

  assert.deepEqual(createWorkflowPageTerminalTargets(elements), {
    terminalStatus: elements.terminalStatus,
    terminalCommandInput: elements.terminalCommandInput,
    terminalArgsInput: elements.terminalArgsInput,
    terminalStartButton: elements.terminalStartButton,
    terminalCancelButton: elements.terminalCancelButton,
    terminalOutput: elements.terminalOutput,
    terminalInput: elements.terminalInput,
    terminalSendButton: elements.terminalSendButton,
  });
});
