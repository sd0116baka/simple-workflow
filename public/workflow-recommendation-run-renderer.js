import { buildRecommendationRunViewModel } from "./recommendation-run-view-model.js";
import { renderRecommendationRunSummary } from "./recommendation-run-summary-renderer.js";
import { renderRecommendationRunLiveState } from "./recommendation-run-live-state-renderer.js";
import { renderRecommendationRunTaskContext } from "./recommendation-run-task-context-renderer.js";
import { renderRecommendationRunNoRunState } from "./recommendation-run-no-run-renderer.js";

export function createWorkflowRecommendationRunRenderer({
  documentRef = document,
  workflowPanelRenderers,
  workflowOverviewRenderers,
  renderWorkflowSections,
} = {}) {
  function render({
    elements,
    recommendationRun,
    poolEntryCount,
    startupCheck,
    taskContextPackage,
  }) {
    const viewModel = buildRecommendationRunViewModel({
      recommendationRun,
      poolEntryCount,
      startupCheck,
    });

    elements.recommendationResult?.replaceChildren();
    elements.recommendationIntentPanel.replaceChildren();
    elements.admissionPanel.replaceChildren();
    elements.taskContextPackagePanel.replaceChildren();
    renderRecommendationRunLiveState({
      elements,
      recommendationRun,
      viewModel,
      workflowOverviewRenderers,
    });
    renderWorkflowSections(taskContextPackage);

    if (!viewModel.hasRun) {
      renderRecommendationRunNoRunState({
        elements,
        viewModel,
        taskContextPackage,
        workflowPanelRenderers,
      });
      return viewModel;
    }

    renderRecommendationRunSummary({
      documentRef,
      elements,
      recommendationRun,
      viewModel,
      workflowPanelRenderers,
    });
    renderRecommendationRunTaskContext({
      elements,
      taskContextPackage,
      workflowPanelRenderers,
    });
    return viewModel;
  }

  return { render };
}
