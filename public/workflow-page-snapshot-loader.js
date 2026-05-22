import { applyWorkflowPageSnapshot } from "./workflow-page-snapshot-state.js";

export function createWorkflowPageSnapshotLoader({
  workflowApi,
  dataRenderers,
  taskSelection,
  getSnapshotState,
  setSnapshotState,
  renderRecommendationRun,
  applySnapshot = applyWorkflowPageSnapshot,
} = {}) {
  async function loadTasks() {
    dataRenderers.renderLoadingState();
    const snapshot = await workflowApi.loadWorkflowSnapshot();
    setSnapshotState(applySnapshot({
      snapshot,
      selectedFileName: getSnapshotState().selectedFileName,
    }));

    dataRenderers.renderList(getSnapshotState());
    dataRenderers.renderTaskPool(getSnapshotState());
    dataRenderers.renderStartupCheck(getSnapshotState());

    if (getSnapshotState().selectedFileName) {
      taskSelection.selectTask(getSnapshotState().selectedFileName);
    } else {
      dataRenderers.renderMissingTaskSelection();
    }

    renderRecommendationRun();
  }

  return {
    loadTasks,
  };
}
