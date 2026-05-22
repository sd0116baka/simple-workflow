import {
  activeTaskContextPackage as resolveActiveTaskContextPackage,
} from "./workflow-page-state.js";
import { createWorkflowPageDataRenderers } from "./workflow-page-data-renderers.js";
import { createWorkflowPageRecommendationSyncController } from "./workflow-page-recommendation-sync-controller.js";
import { createWorkflowPageSnapshotLoader } from "./workflow-page-snapshot-loader.js";
import { createWorkflowPageTaskSelection } from "./workflow-page-task-selection.js";
import { createEmptyWorkflowPageSnapshotState } from "./workflow-page-snapshot-state.js";

export function createWorkflowPageDataController({
  workflowApi,
  workflowOverviewRenderers,
  workflowSectionRenderer,
  workflowRecommendationRunRenderer,
  elements,
  createDataRenderers = createWorkflowPageDataRenderers,
  createRecommendationSyncController = createWorkflowPageRecommendationSyncController,
  createSnapshotLoader = createWorkflowPageSnapshotLoader,
  createTaskSelection = createWorkflowPageTaskSelection,
} = {}) {
  let snapshotState = createEmptyWorkflowPageSnapshotState();

  const dataRenderers = createDataRenderers({
    elements,
    workflowOverviewRenderers,
    workflowSectionRenderer,
    workflowRecommendationRunRenderer,
  });
  const taskSelection = createTaskSelection({
    dataRenderers,
    getSnapshotState: () => snapshotState,
    setSnapshotState: (nextSnapshotState) => {
      snapshotState = nextSnapshotState;
    },
    renderList,
    renderTaskPool,
    renderRecommendationRun,
  });
  const recommendationSyncController = createRecommendationSyncController({
    workflowApi,
    elements,
    getSnapshotState: () => snapshotState,
    setSnapshotState: (nextSnapshotState) => {
      snapshotState = nextSnapshotState;
    },
    resolveActiveTaskContextPackage: ({ recommendationRun }) =>
      resolveActiveTaskContextPackage({
        selectedFileName: snapshotState.selectedFileName,
        poolTaskContextPackages: snapshotState.poolTaskContextPackages,
        recommendationRun,
      }),
    renderRecommendationRun: (payload) =>
      dataRenderers.renderRecommendationRun(payload),
  });
  const snapshotLoader = createSnapshotLoader({
    workflowApi,
    dataRenderers,
    taskSelection,
    getSnapshotState: () => snapshotState,
    setSnapshotState: (nextSnapshotState) => {
      snapshotState = nextSnapshotState;
    },
    renderRecommendationRun,
  });

  function activeTaskContextPackage() {
    return resolveActiveTaskContextPackage({
      selectedFileName: snapshotState.selectedFileName,
      poolTaskContextPackages: snapshotState.poolTaskContextPackages,
      recommendationRun: recommendationSyncController.getRecommendationRun(),
    });
  }

  function setRecommendationRun(nextRecommendationRun, { syncTaskPackage = false } = {}) {
    recommendationSyncController.setRecommendationRun(nextRecommendationRun, {
      syncTaskPackage,
    });
  }

  function renderWorkflowSections(taskContextPackage) {
    dataRenderers.renderWorkflowSections(taskContextPackage);
  }

  function renderList() {
    dataRenderers.renderList(snapshotState);
  }

  function renderTaskPool() {
    dataRenderers.renderTaskPool(snapshotState);
  }

  function renderRecommendationRun() {
    recommendationSyncController.renderRecommendationRun();
  }

  return {
    activeTaskContextPackage,
    getSelectedFileName: taskSelection.getSelectedFileName,
    isRecommendationRunRunning: recommendationSyncController.isRecommendationRunRunning,
    latestRecommendationSyncAt: recommendationSyncController.latestRecommendationSyncAt,
    loadRecommendationRun: recommendationSyncController.loadRecommendationRun,
    markRecommendationConnectionInterrupted:
      recommendationSyncController.markRecommendationConnectionInterrupted,
    loadTasks: snapshotLoader.loadTasks,
    renderRecommendationRun,
    renderWorkflowSections,
    selectTask: taskSelection.selectTask,
    setRecommendationRun,
    setSelectedFileName: taskSelection.setSelectedFileName,
    syncRecommendationRunSilently: recommendationSyncController.syncRecommendationRunSilently,
  };
}
