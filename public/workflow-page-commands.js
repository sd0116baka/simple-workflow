import { createWorkflowPageCommandBindings } from "./workflow-page-command-bindings.js";
import { createWorkflowPageCommandGroups } from "./workflow-page-command-groups.js";

export function createWorkflowPageCommands({
  workflowApi,
  activeTaskContextPackage,
  setRecommendationRun,
  renderRecommendationRun,
  loadTasks,
  loadRecommendationRun,
  getSelectedFileName,
  setSelectedFileName,
  elements,
  showError,
  documentRef = document,
  createCommandGroups = createWorkflowPageCommandGroups,
  createCommandBindings = createWorkflowPageCommandBindings,
} = {}) {
  const commandGroups = createCommandGroups({
    workflowApi,
    activeTaskContextPackage,
    setRecommendationRun,
    renderRecommendationRun,
    loadTasks,
    loadRecommendationRun,
    getSelectedFileName,
    setSelectedFileName,
    elements,
  });

  const commandBindings = createCommandBindings({
    elements,
    documentRef,
    showError,
    commandActions: commandGroups.commandActions,
  });

  return {
    ...commandGroups.pageCommands,
    handleDocumentAction: commandBindings.handleDocumentAction,
    bindPageControls: commandBindings.bindPageControls,
  };
}
