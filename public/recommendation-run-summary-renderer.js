import { createElement } from "./dom-renderer-helpers.js";

export function renderRecommendationRunSummary({
  documentRef,
  elements,
  recommendationRun,
  viewModel,
  workflowPanelRenderers,
}) {
  elements.recommendationStatus.textContent = viewModel.recommendationStatus;

  const summary = createElement(documentRef, "div", {
    className: viewModel.summary.className,
    textContent: viewModel.summary.text,
  });
  const meta = createElement(documentRef, "div", {
    className: "recommendation-meta",
    textContent: viewModel.metaText,
  });

  if (recommendationRun.executionIntent) {
    elements.recommendationResult?.append(
      summary,
      meta,
      workflowPanelRenderers.createIntentPanel(recommendationRun.executionIntent),
    );
    elements.recommendationIntentPanel.append(
      workflowPanelRenderers.createIntentPanel(recommendationRun.executionIntent),
    );
  } else {
    elements.recommendationResult?.append(summary, meta);
    elements.recommendationIntentPanel.textContent = viewModel.recommendationIntentText;
  }

  if (recommendationRun.executionAdmission) {
    elements.admissionStatus.textContent = viewModel.admissionStatus;
    elements.admissionPanel.append(
      workflowPanelRenderers.createAdmissionPanel(recommendationRun.executionAdmission),
    );
  } else {
    elements.admissionStatus.textContent = viewModel.admissionStatus;
    elements.admissionPanel.textContent = viewModel.admissionPanelText;
  }

  const output = createElement(documentRef, "pre", {
    className: "recommendation-output",
    textContent: viewModel.outputText,
  });
  elements.recommendationResult?.append(output);
}
