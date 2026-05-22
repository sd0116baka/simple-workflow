import {
  formatJsonBlock,
  formatTerminalProgress,
} from "./workflow-formatters.js";

export function renderRecommendationRunLiveState({
  elements,
  recommendationRun,
  viewModel,
  workflowOverviewRenderers,
}) {
  elements.recommendationRaw.textContent = viewModel.rawText;

  if (elements.recommendationTerminal) {
    elements.recommendationTerminal.textContent = formatTerminalProgress(recommendationRun);
    elements.recommendationTerminal.scrollTop = elements.recommendationTerminal.scrollHeight;
  }

  elements.admissionRaw.textContent = formatJsonBlock(recommendationRun?.executionIntentAppendRequest);
  workflowOverviewRenderers.renderInputs(elements.recommendationInputs, viewModel.recommendationInputs);
  workflowOverviewRenderers.renderInputs(elements.admissionInputs, viewModel.admissionInputs);

  elements.runRecommendationButton.disabled = viewModel.controls.runDisabled;
  if (elements.cancelRecommendationButton) {
    elements.cancelRecommendationButton.hidden = viewModel.controls.cancelHidden;
    elements.cancelRecommendationButton.disabled = viewModel.controls.cancelDisabled;
    elements.cancelRecommendationButton.textContent = viewModel.controls.cancelText;
  }
}
