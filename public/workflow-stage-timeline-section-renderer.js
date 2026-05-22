import { buildStageTimelineSectionViewModel } from "./stage-timeline-section-view-model.js";

export function renderWorkflowStageTimelineSection({
  elements,
  taskContextPackage,
  workflowPanelRenderers,
}) {
  const viewModel = buildStageTimelineSectionViewModel(taskContextPackage);
  elements.panel.replaceChildren();
  elements.status.textContent = viewModel.statusText;

  if (viewModel.emptyText) {
    elements.panel.textContent = viewModel.emptyText;
    return viewModel;
  }

  elements.panel.append(workflowPanelRenderers.createStageTimelinePanel(viewModel));
  return viewModel;
}
