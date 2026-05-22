import {
  renderMissingWorkflowTaskSelection,
  renderSelectedWorkflowTask,
} from "./workflow-page-selected-task-renderer.js";

export function createWorkflowPageSelectedTaskDataRenderer({
  elements,
  workflowOverviewRenderers,
} = {}) {
  function renderSelectedTask(snapshotState) {
    return renderSelectedWorkflowTask({
      elements,
      workflowOverviewRenderers,
      tasks: snapshotState.tasks,
      selectedFileName: snapshotState.selectedFileName,
    });
  }

  function renderMissingTaskSelection() {
    renderMissingWorkflowTaskSelection({
      elements,
      workflowOverviewRenderers,
    });
  }

  return {
    renderMissingTaskSelection,
    renderSelectedTask,
  };
}
