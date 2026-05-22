import { createWorkflowPageCommands } from "./workflow-page-commands.js";
import { createWorkflowPageCommandTargets } from "./workflow-page-shell-targets.js";

export function createWorkflowPageShellCommandGraph({
  workflowApi,
  elements,
  workflowPageDataController,
  showError,
  createCommands = createWorkflowPageCommands,
} = {}) {
  const workflowPageCommands = createCommands({
    workflowApi,
    activeTaskContextPackage: workflowPageDataController.activeTaskContextPackage,
    setRecommendationRun: workflowPageDataController.setRecommendationRun,
    renderRecommendationRun: workflowPageDataController.renderRecommendationRun,
    loadTasks: workflowPageDataController.loadTasks,
    loadRecommendationRun: workflowPageDataController.loadRecommendationRun,
    getSelectedFileName: workflowPageDataController.getSelectedFileName,
    setSelectedFileName: workflowPageDataController.setSelectedFileName,
    startTerminalSession: workflowPageDataController.startTerminalSession,
    sendTerminalInput: workflowPageDataController.sendTerminalInput,
    cancelTerminalSession: workflowPageDataController.cancelTerminalSession,
    elements: createWorkflowPageCommandTargets(elements),
    showError,
  });

  return {
    workflowPageCommands,
  };
}
