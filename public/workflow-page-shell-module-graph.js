import { createWorkflowPageDataController } from "./workflow-page-data-controller.js";
import { createWorkflowPageShellCommandGraph } from "./workflow-page-shell-command-graph.js";
import { createWorkflowPageShellRendererGraph } from "./workflow-page-shell-renderer-graph.js";

export function createWorkflowPageShellModuleGraph({
  workflowApi,
  elements,
  showError,
  createCommandGraph = createWorkflowPageShellCommandGraph,
  createDataController = createWorkflowPageDataController,
  createRendererGraph = createWorkflowPageShellRendererGraph,
} = {}) {
  let workflowPageCommands;
  let workflowPageDataController;

  const getWorkflowPageCommands = () => workflowPageCommands;
  const getWorkflowPageDataController = () => workflowPageDataController;

  const rendererGraph = createRendererGraph({
    getCommands: getWorkflowPageCommands,
    getDataController: getWorkflowPageDataController,
    showError,
  });
  const {
    workflowOverviewRenderers,
    workflowPanelRenderers,
    workflowRecommendationRunRenderer,
    workflowSectionRenderer,
  } = rendererGraph;
  workflowPageDataController = createDataController({
    workflowApi,
    workflowOverviewRenderers,
    workflowSectionRenderer,
    workflowRecommendationRunRenderer,
    elements,
  });
  const commandGraph = createCommandGraph({
    workflowApi,
    elements,
    showError,
    workflowPageDataController,
  });
  workflowPageCommands = commandGraph.workflowPageCommands;

  return {
    workflowOverviewRenderers,
    workflowPageCommands,
    workflowPageDataController,
    workflowPanelRenderers,
    workflowRecommendationRunRenderer,
    workflowSectionRenderer,
  };
}
