import { formatJsonBlock } from "./workflow-formatters.js";

export function renderWorkflowArtifactSection({
  elements,
  viewModel,
  taskContextPackage,
  workflowOverviewRenderers,
  workflowPanelRenderers,
}) {
  elements.panel.replaceChildren();
  elements.raw.textContent = formatJsonBlock(viewModel.rawObject);
  workflowOverviewRenderers.renderInputs(elements.inputs, viewModel.inputs);
  elements.status.textContent = viewModel.statusText;
  if (workflowPanelRenderers.appendWorkflowSectionPanel(
    elements.panel,
    viewModel.panel,
    taskContextPackage,
  )) {
    return true;
  }

  elements.panel.textContent = viewModel.text;
  return false;
}
