import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageRecommendationRunDataRenderer } from "../public/workflow-page-recommendation-run-data-renderer.js";

function element(name) {
  return { name };
}

function createElements() {
  return {
    recommendationResult: element("recommendationResult"),
    recommendationIntentPanel: element("recommendationIntentPanel"),
    admissionPanel: element("admissionPanel"),
    taskContextPackagePanel: element("taskContextPackagePanel"),
    taskContextPackageRaw: element("taskContextPackageRaw"),
    recommendationRaw: element("recommendationRaw"),
    recommendationTerminal: element("recommendationTerminal"),
    admissionRaw: element("admissionRaw"),
    recommendationInputs: element("recommendationInputs"),
    admissionInputs: element("admissionInputs"),
    runRecommendationButton: element("runRecommendationButton"),
    cancelRecommendationButton: element("cancelRecommendationButton"),
    recommendationStatus: element("recommendationStatus"),
    admissionStatus: element("admissionStatus"),
    taskContextPackageStatus: element("taskContextPackageStatus"),
    humanDecisionStatus: element("humanDecisionStatus"),
    humanDecisionRaw: element("humanDecisionRaw"),
    humanDecisionPanel: element("humanDecisionPanel"),
    autoMergeStatus: element("autoMergeStatus"),
    autoMergeRaw: element("autoMergeRaw"),
    autoMergePanel: element("autoMergePanel"),
    autoMergeExecutionStatus: element("autoMergeExecutionStatus"),
    autoMergeExecutionRaw: element("autoMergeExecutionRaw"),
    autoMergeExecutionPanel: element("autoMergeExecutionPanel"),
    taskCloseoutStatus: element("taskCloseoutStatus"),
    taskCloseoutRaw: element("taskCloseoutRaw"),
    taskCloseoutPanel: element("taskCloseoutPanel"),
  };
}

test("workflow page recommendation run data renderer maps snapshot payload and targets", () => {
  const calls = [];
  const elements = createElements();
  const activeTaskContextPackage = { packageId: "package:active" };
  const recommendationRun = { id: "run:001" };
  const snapshotState = {
    poolEntries: [{ sourceFile: "task-001.yaml" }, { sourceFile: "task-002.yaml" }],
    startupCheck: { canStartWork: true },
  };
  const renderer = createWorkflowPageRecommendationRunDataRenderer({
    elements,
    workflowRecommendationRunRenderer: {
      render(payload) {
        calls.push(payload);
      },
    },
  });

  renderer.renderRecommendationRun({
    activeTaskContextPackage,
    recommendationRun,
    snapshotState,
  });

  assert.equal(calls.length, 1);
  const [payload] = calls;
  assert.equal(payload.recommendationRun, recommendationRun);
  assert.equal(payload.poolEntryCount, 2);
  assert.equal(payload.startupCheck, snapshotState.startupCheck);
  assert.equal(payload.taskContextPackage, activeTaskContextPackage);
  assert.equal(payload.elements.recommendationResult, elements.recommendationResult);
  assert.equal(payload.elements.recommendationIntentPanel, elements.recommendationIntentPanel);
  assert.equal(payload.elements.taskContextPackageRaw, elements.taskContextPackageRaw);
  assert.equal(payload.elements.humanDecisionRaw, elements.humanDecisionRaw);
  assert.equal(payload.elements.autoMergeExecutionStatus, elements.autoMergeExecutionStatus);
  assert.equal(payload.elements.taskCloseoutPanel, elements.taskCloseoutPanel);
});

test("workflow page recommendation run data renderer projects running agent progress as active package", () => {
  const calls = [];
  const elements = createElements();
  const activeTaskContextPackage = { packageId: "package:selected", currentWorkStage: "task-pool" };
  const recommendationRun = {
    id: "run:001",
    status: "running",
    executionIntentAppendRequest: {
      packageId: "task-context-package:tasks/task-001.yaml",
    },
    progress: [
      {
        type: "review_process_start",
        message: "启动 review-agent:001：opencode run --format json",
      },
    ],
  };
  const snapshotState = {
    poolEntries: [{ sourceFile: "task-001.yaml" }],
    startupCheck: { canStartWork: true },
  };
  const renderer = createWorkflowPageRecommendationRunDataRenderer({
    elements,
    workflowRecommendationRunRenderer: {
      render(payload) {
        calls.push(payload);
      },
    },
  });

  renderer.renderRecommendationRun({
    activeTaskContextPackage,
    recommendationRun,
    snapshotState,
  });

  assert.equal(calls[0].taskContextPackage.packageId, "task-context-package:tasks/task-001.yaml");
  assert.equal(calls[0].taskContextPackage.currentWorkStage, "review-agent");
});
