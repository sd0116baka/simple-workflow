import { createWorkflowPageOverviewDataRenderer } from "./workflow-page-overview-data-renderer.js";
import { createWorkflowPageRecommendationRunDataRenderer } from "./workflow-page-recommendation-run-data-renderer.js";
import { createWorkflowPageSelectedTaskDataRenderer } from "./workflow-page-selected-task-data-renderer.js";
import { createWorkflowSectionRenderTargets } from "./workflow-page-render-targets.js";

export function createWorkflowPageDataRenderers({
  elements,
  workflowOverviewRenderers,
  workflowSectionRenderer,
  workflowRecommendationRunRenderer,
} = {}) {
  const overviewDataRenderer = createWorkflowPageOverviewDataRenderer({
    elements,
    workflowOverviewRenderers,
  });
  const recommendationRunDataRenderer = createWorkflowPageRecommendationRunDataRenderer({
    elements,
    workflowRecommendationRunRenderer,
  });
  const workflowSectionElements = createWorkflowSectionRenderTargets(elements);
  const selectedTaskDataRenderer = createWorkflowPageSelectedTaskDataRenderer({
    elements,
    workflowOverviewRenderers,
  });

  function renderLoadingState() {
    elements.rawText.textContent = "正在读取 tasks/ ...";
    if (elements.parsedText) elements.parsedText.textContent = "";
    if (elements.validationResult) elements.validationResult.textContent = "";
    elements.parseStatus.textContent = "等待载入";
    if (elements.validationStatus) elements.validationStatus.textContent = "等待载入";
    elements.startupCheckPanel.textContent = "正在读取启动检查...";
    elements.startupCheckStatus.textContent = "等待载入";
  }

  function renderWorkflowSections(taskContextPackage) {
    workflowSectionRenderer.renderAll({
      elements: workflowSectionElements,
      taskContextPackage,
    });
  }

  function renderList(snapshotState) {
    overviewDataRenderer.renderList(snapshotState);
  }

  function renderTaskPool(snapshotState) {
    overviewDataRenderer.renderTaskPool(snapshotState);
  }

  function renderStartupCheck(snapshotState) {
    overviewDataRenderer.renderStartupCheck(snapshotState);
  }

  function renderRecommendationRun({
    activeTaskContextPackage,
    recommendationRun,
    snapshotState,
  }) {
    recommendationRunDataRenderer.renderRecommendationRun({
      activeTaskContextPackage,
      recommendationRun,
      snapshotState,
    });
  }

  function renderSelectedTask(snapshotState) {
    return selectedTaskDataRenderer.renderSelectedTask(snapshotState);
  }

  function renderMissingTaskSelection() {
    selectedTaskDataRenderer.renderMissingTaskSelection();
  }

  return {
    renderList,
    renderLoadingState,
    renderMissingTaskSelection,
    renderRecommendationRun,
    renderSelectedTask,
    renderStartupCheck,
    renderTaskPool,
    renderWorkflowSections,
  };
}
