import { createWorkflowPageDataController } from "../../public/workflow-page-data-controller.js";
import { createTaskContextPackageFixture } from "./task-context-package-fixtures.js";

export function createWorkflowPageControllerElement() {
  return {
    children: [],
    disabled: false,
    hidden: false,
    scrollHeight: 0,
    scrollTop: 0,
    textContent: "",
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = children;
      this.textContent = "";
    },
  };
}

export function createWorkflowPageControllerElements() {
  return {
    taskList: createWorkflowPageControllerElement(),
    taskCount: createWorkflowPageControllerElement(),
    taskPool: createWorkflowPageControllerElement(),
    poolCount: createWorkflowPageControllerElement(),
    startupCheckPanel: createWorkflowPageControllerElement(),
    startupCheckStatus: createWorkflowPageControllerElement(),
    selectedTitle: createWorkflowPageControllerElement(),
    selectedMeta: createWorkflowPageControllerElement(),
    rawText: createWorkflowPageControllerElement(),
    parsedText: createWorkflowPageControllerElement(),
    parseStatus: createWorkflowPageControllerElement(),
    validationResult: createWorkflowPageControllerElement(),
    validationStatus: createWorkflowPageControllerElement(),
    recommendationStatus: createWorkflowPageControllerElement(),
    recommendationResult: createWorkflowPageControllerElement(),
    runRecommendationButton: createWorkflowPageControllerElement(),
    cancelRecommendationButton: createWorkflowPageControllerElement(),
    taskPoolRaw: createWorkflowPageControllerElement(),
    startupCheckRaw: createWorkflowPageControllerElement(),
    recommendationRaw: createWorkflowPageControllerElement(),
    recommendationTerminal: createWorkflowPageControllerElement(),
    recommendationIntentPanel: createWorkflowPageControllerElement(),
    admissionStatus: createWorkflowPageControllerElement(),
    admissionRaw: createWorkflowPageControllerElement(),
    admissionPanel: createWorkflowPageControllerElement(),
    stageTimelineStatus: createWorkflowPageControllerElement(),
    stageTimelinePanel: createWorkflowPageControllerElement(),
    taskContextPackageRaw: createWorkflowPageControllerElement(),
    taskContextPackagePanel: createWorkflowPageControllerElement(),
    taskContextPackageStatus: createWorkflowPageControllerElement(),
    taskSourceInputs: createWorkflowPageControllerElement(),
    taskPoolInputs: createWorkflowPageControllerElement(),
    startupCheckInputs: createWorkflowPageControllerElement(),
    recommendationInputs: createWorkflowPageControllerElement(),
    admissionInputs: createWorkflowPageControllerElement(),
    humanDecisionStatus: createWorkflowPageControllerElement(),
    humanDecisionInputs: createWorkflowPageControllerElement(),
    humanDecisionRaw: createWorkflowPageControllerElement(),
    humanDecisionPanel: createWorkflowPageControllerElement(),
    autoMergeStatus: createWorkflowPageControllerElement(),
    autoMergeInputs: createWorkflowPageControllerElement(),
    autoMergeRaw: createWorkflowPageControllerElement(),
    autoMergePanel: createWorkflowPageControllerElement(),
    autoMergeExecutionStatus: createWorkflowPageControllerElement(),
    autoMergeExecutionInputs: createWorkflowPageControllerElement(),
    autoMergeExecutionRaw: createWorkflowPageControllerElement(),
    autoMergeExecutionPanel: createWorkflowPageControllerElement(),
    taskCloseoutStatus: createWorkflowPageControllerElement(),
    taskCloseoutInputs: createWorkflowPageControllerElement(),
    taskCloseoutRaw: createWorkflowPageControllerElement(),
    taskCloseoutPanel: createWorkflowPageControllerElement(),
  };
}

export function createWorkflowPageTaskContextPackage({
  packageId = "task-context-package:tasks/task-001.yaml",
  sourcePath = "tasks/task-001.yaml",
  stage = "task-pool",
} = {}) {
  return createTaskContextPackageFixture({
    packageId,
    currentWorkStage: stage,
    source: { path: sourcePath },
  });
}

export function createWorkflowPageDataControllerHarness({
  snapshot = {
    tasks: [{ fileName: "task-001.yaml", validation: { ok: true } }],
    taskPool: {
      entries: [{ fileName: "task-001.yaml" }],
      taskContextPackages: [createWorkflowPageTaskContextPackage()],
    },
    startupCheck: { ok: true },
  },
  recommendationRun = null,
} = {}) {
  const calls = [];
  const elements = createWorkflowPageControllerElements();
  const workflowApi = {
    async loadWorkflowSnapshot() {
      calls.push(["loadWorkflowSnapshot"]);
      return snapshot;
    },
    async loadRecommendationRun() {
      calls.push(["loadRecommendationRun"]);
      return { recommendationRun };
    },
  };
  const workflowOverviewRenderers = {
    renderTaskSource(payload) {
      calls.push(["renderTaskSource", payload.selectedFileName, payload.tasks.length]);
    },
    renderTaskPool(payload) {
      calls.push(["renderTaskPool", payload.selectedFileName, payload.poolEntries.length]);
    },
    renderStartupCheck(payload) {
      calls.push(["renderStartupCheck", payload.startupCheck]);
    },
    renderSelectedTask(payload) {
      calls.push(["renderSelectedTask", payload.task.fileName]);
    },
    renderMissingTaskSelection() {
      calls.push(["renderMissingTaskSelection"]);
    },
  };
  const workflowSectionRenderer = {
    renderAll(payload) {
      calls.push(["renderWorkflowSections", payload.taskContextPackage?.packageId ?? null]);
    },
  };
  const workflowRecommendationRunRenderer = {
    render(payload) {
      calls.push([
        "renderRecommendationRun",
        payload.recommendationRun?.id ?? null,
        payload.poolEntryCount,
        payload.taskContextPackage?.packageId ?? null,
      ]);
    },
  };
  const controller = createWorkflowPageDataController({
    workflowApi,
    workflowOverviewRenderers,
    workflowSectionRenderer,
    workflowRecommendationRunRenderer,
    elements,
  });

  return {
    calls,
    controller,
    elements,
    workflowApi,
  };
}
