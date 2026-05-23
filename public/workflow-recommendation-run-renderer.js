import { buildRecommendationRunViewModel } from "./recommendation-run-view-model.js";
import { renderRecommendationRunAgentDebug } from "./recommendation-run-agent-debug-renderer.js";
import { renderRecommendationRunSummary } from "./recommendation-run-summary-renderer.js";
import { renderRecommendationRunTaskContext } from "./recommendation-run-task-context-renderer.js";
import { renderRecommendationRunNoRunState } from "./recommendation-run-no-run-renderer.js";
import {
  formatJsonBlock,
  formatTerminalProgress,
} from "./workflow-formatters.js";

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
      documentRef,
      elements,
      recommendationRun,
      taskContextPackage,
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

export function renderRecommendationRunLiveState({
  documentRef,
  elements,
  recommendationRun,
  taskContextPackage,
  viewModel,
  workflowOverviewRenderers,
}) {
  elements.recommendationRaw.textContent = viewModel.rawText;

  if (elements.recommendationTerminal) {
    elements.recommendationTerminal.textContent = formatTerminalProgress(recommendationRun);
    elements.recommendationTerminal.scrollTop = elements.recommendationTerminal.scrollHeight;
  }
  renderRecommendationRunAgentDebug({
    documentRef,
    elements,
    recommendationRun,
    taskContextPackage,
  });

  elements.admissionRaw.textContent = formatJsonBlock(recommendationRun?.executionIntentAppendRequest);
  workflowOverviewRenderers.renderInputs(elements.recommendationInputs, viewModel.recommendationInputs);
  workflowOverviewRenderers.renderInputs(elements.admissionInputs, viewModel.admissionInputs);

  elements.runRecommendationButton.disabled = viewModel.controls.runDisabled;
  if (elements.runWorkflowButton) {
    elements.runWorkflowButton.disabled = viewModel.controls.runDisabled;
  }
  if (elements.cancelRecommendationButton) {
    elements.cancelRecommendationButton.hidden = viewModel.controls.cancelHidden;
    elements.cancelRecommendationButton.disabled = viewModel.controls.cancelDisabled;
    elements.cancelRecommendationButton.textContent = viewModel.controls.cancelText;
  }
}
