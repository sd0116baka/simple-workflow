import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageDataRenderers } from "../public/workflow-page-data-renderers.js";

function element() {
  return {
    children: [],
    textContent: "",
    replaceChildren(...children) {
      this.children = children;
      this.textContent = "";
    },
  };
}

function createElements() {
  return {
    taskList: element(),
    taskCount: element(),
    taskPool: element(),
    poolCount: element(),
    startupCheckPanel: element(),
    startupCheckStatus: element(),
    selectedTitle: element(),
    selectedMeta: element(),
    rawText: element(),
    parsedText: element(),
    parseStatus: element(),
    validationResult: element(),
    validationStatus: element(),
    recommendationStatus: element(),
    recommendationResult: element(),
    runRecommendationButton: element(),
    cancelRecommendationButton: element(),
    taskPoolRaw: element(),
    startupCheckRaw: element(),
    recommendationRaw: element(),
    recommendationTerminal: element(),
    recommendationIntentPanel: element(),
    admissionStatus: element(),
    admissionRaw: element(),
    admissionPanel: element(),
    stageTimelineStatus: element(),
    stageTimelinePanel: element(),
    taskContextPackageRaw: element(),
    taskContextPackagePanel: element(),
    taskContextPackageStatus: element(),
    taskSourceInputs: element(),
    taskPoolInputs: element(),
    startupCheckInputs: element(),
    recommendationInputs: element(),
    admissionInputs: element(),
    humanDecisionStatus: element(),
    humanDecisionInputs: element(),
    humanDecisionRaw: element(),
    humanDecisionPanel: element(),
    autoMergeStatus: element(),
    autoMergeInputs: element(),
    autoMergeRaw: element(),
    autoMergePanel: element(),
    autoMergeExecutionStatus: element(),
    autoMergeExecutionInputs: element(),
    autoMergeExecutionRaw: element(),
    autoMergeExecutionPanel: element(),
    taskCloseoutStatus: element(),
    taskCloseoutInputs: element(),
    taskCloseoutRaw: element(),
    taskCloseoutPanel: element(),
  };
}

function createHarness() {
  const calls = [];
  const elements = createElements();
  const workflowOverviewRenderers = {
    renderTaskSource(payload) {
      calls.push(["renderTaskSource", payload]);
    },
    renderTaskPool(payload) {
      calls.push(["renderTaskPool", payload]);
    },
    renderStartupCheck(payload) {
      calls.push(["renderStartupCheck", payload]);
    },
    renderSelectedTask(payload) {
      calls.push(["renderSelectedTask", payload]);
    },
    renderMissingTaskSelection(payload) {
      calls.push(["renderMissingTaskSelection", payload]);
    },
  };
  const workflowSectionRenderer = {
    renderAll(payload) {
      calls.push(["renderWorkflowSections", payload]);
    },
  };
  const workflowRecommendationRunRenderer = {
    render(payload) {
      calls.push(["renderRecommendationRun", payload]);
    },
  };

  return {
    calls,
    dataRenderers: createWorkflowPageDataRenderers({
      elements,
      workflowOverviewRenderers,
      workflowSectionRenderer,
      workflowRecommendationRunRenderer,
    }),
    elements,
  };
}

test("workflow page data renderers delegate overview payloads with projected element targets", () => {
  const { calls, dataRenderers, elements } = createHarness();
  const snapshotState = {
    tasks: [{ fileName: "task-001.yaml" }],
    poolEntries: [{ fileName: "task-001.yaml" }],
    selectedFileName: "task-001.yaml",
    startupCheck: { ok: true },
  };

  dataRenderers.renderList(snapshotState);
  dataRenderers.renderTaskPool(snapshotState);
  dataRenderers.renderStartupCheck(snapshotState);
  assert.equal(dataRenderers.renderSelectedTask(snapshotState), true);
  dataRenderers.renderMissingTaskSelection();

  assert.equal(calls[0][0], "renderTaskSource");
  assert.equal(calls[0][1].taskList, elements.taskList);
  assert.equal(calls[0][1].taskCount, elements.taskCount);
  assert.equal(calls[0][1].taskSourceInputs, elements.taskSourceInputs);
  assert.equal(calls[0][1].tasks, snapshotState.tasks);
  assert.equal(calls[0][1].selectedFileName, "task-001.yaml");

  assert.equal(calls[1][0], "renderTaskPool");
  assert.equal(calls[1][1].taskPool, elements.taskPool);
  assert.equal(calls[1][1].poolCount, elements.poolCount);
  assert.equal(calls[1][1].taskPoolRaw, elements.taskPoolRaw);
  assert.equal(calls[1][1].taskPoolInputs, elements.taskPoolInputs);
  assert.equal(calls[1][1].poolEntries, snapshotState.poolEntries);

  assert.equal(calls[2][0], "renderStartupCheck");
  assert.equal(calls[2][1].startupCheckPanel, elements.startupCheckPanel);
  assert.equal(calls[2][1].startupCheckRaw, elements.startupCheckRaw);
  assert.equal(calls[2][1].startupCheckInputs, elements.startupCheckInputs);
  assert.equal(calls[2][1].startupCheckStatus, elements.startupCheckStatus);
  assert.equal(calls[2][1].startupCheck, snapshotState.startupCheck);

  assert.equal(calls[3][0], "renderSelectedTask");
  assert.equal(calls[3][1].selectedTitle, elements.selectedTitle);
  assert.equal(calls[3][1].rawText, elements.rawText);
  assert.equal(calls[3][1].validationStatus, elements.validationStatus);
  assert.equal(calls[3][1].task, snapshotState.tasks[0]);

  assert.equal(calls[4][0], "renderMissingTaskSelection");
  assert.equal(calls[4][1].selectedMeta, elements.selectedMeta);
  assert.equal(calls[4][1].parseStatus, elements.parseStatus);
});

test("workflow page data renderers report missing selected tasks without rendering details", () => {
  const { calls, dataRenderers } = createHarness();

  assert.equal(dataRenderers.renderSelectedTask({
    tasks: [{ fileName: "task-001.yaml" }],
    selectedFileName: "missing.yaml",
  }), false);

  assert.deepEqual(calls, []);
});

test("workflow page data renderers delegate workflow section render targets", () => {
  const { calls, dataRenderers, elements } = createHarness();
  const taskContextPackage = { packageId: "package:001" };

  dataRenderers.renderWorkflowSections(taskContextPackage);

  assert.equal(calls.length, 1);
  const [callName, payload] = calls[0];
  assert.equal(callName, "renderWorkflowSections");
  assert.equal(payload.taskContextPackage, taskContextPackage);
  assert.equal(payload.elements.humanDecision.status, elements.humanDecisionStatus);
  assert.equal(payload.elements.humanDecision.inputs, elements.humanDecisionInputs);
  assert.equal(payload.elements.autoMerge.raw, elements.autoMergeRaw);
  assert.equal(payload.elements.autoMergeExecution.panel, elements.autoMergeExecutionPanel);
  assert.equal(payload.elements.taskCloseout.status, elements.taskCloseoutStatus);
  assert.equal(payload.elements.stageTimeline.panel, elements.stageTimelinePanel);
});

test("workflow page data renderers delegate recommendation render payloads and targets", () => {
  const { calls, dataRenderers, elements } = createHarness();
  const activeTaskContextPackage = { packageId: "package:active" };
  const recommendationRun = { id: "run:001" };
  const snapshotState = {
    poolEntries: [{ fileName: "task-001.yaml" }, { fileName: "task-002.yaml" }],
    startupCheck: { ok: true },
  };

  dataRenderers.renderRecommendationRun({
    activeTaskContextPackage,
    recommendationRun,
    snapshotState,
  });

  assert.equal(calls.length, 1);
  const [callName, payload] = calls[0];
  assert.equal(callName, "renderRecommendationRun");
  assert.equal(payload.recommendationRun, recommendationRun);
  assert.equal(payload.poolEntryCount, 2);
  assert.equal(payload.startupCheck, snapshotState.startupCheck);
  assert.equal(payload.taskContextPackage, activeTaskContextPackage);
  assert.equal(payload.elements.recommendationResult, elements.recommendationResult);
  assert.equal(payload.elements.taskContextPackageRaw, elements.taskContextPackageRaw);
  assert.equal(payload.elements.humanDecisionRaw, elements.humanDecisionRaw);
  assert.equal(payload.elements.autoMergeExecutionStatus, elements.autoMergeExecutionStatus);
  assert.equal(payload.elements.taskCloseoutPanel, elements.taskCloseoutPanel);
});

test("workflow page data renderers keep loading state behind the data rendering facade", () => {
  const { dataRenderers, elements } = createHarness();

  dataRenderers.renderLoadingState();

  assert.equal(elements.rawText.textContent, "正在读取 tasks/ ...");
  assert.equal(elements.parseStatus.textContent, "等待载入");
  assert.equal(elements.validationStatus.textContent, "等待载入");
  assert.equal(elements.startupCheckPanel.textContent, "正在读取启动检查...");
  assert.equal(elements.startupCheckStatus.textContent, "等待载入");
});
