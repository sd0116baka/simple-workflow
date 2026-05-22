import {
  renderWorkflowStartupCheck,
  renderWorkflowTaskPool,
  renderWorkflowTaskSource,
} from "./workflow-page-overview-renderer.js";

export function createWorkflowPageOverviewDataRenderer({
  elements,
  workflowOverviewRenderers,
} = {}) {
  function renderList(snapshotState) {
    renderWorkflowTaskSource({
      elements,
      workflowOverviewRenderers,
      tasks: snapshotState.tasks,
      selectedFileName: snapshotState.selectedFileName,
    });
  }

  function renderTaskPool(snapshotState) {
    renderWorkflowTaskPool({
      elements,
      workflowOverviewRenderers,
      tasks: snapshotState.tasks,
      poolEntries: snapshotState.poolEntries,
      selectedFileName: snapshotState.selectedFileName,
    });
  }

  function renderStartupCheck(snapshotState) {
    renderWorkflowStartupCheck({
      elements,
      workflowOverviewRenderers,
      startupCheck: snapshotState.startupCheck,
    });
  }

  return {
    renderList,
    renderStartupCheck,
    renderTaskPool,
  };
}
