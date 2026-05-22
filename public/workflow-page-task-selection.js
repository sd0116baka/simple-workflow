export function createWorkflowPageTaskSelection({
  dataRenderers,
  getSnapshotState,
  setSnapshotState,
  renderList,
  renderTaskPool,
  renderRecommendationRun,
} = {}) {
  function getSelectedFileName() {
    return getSnapshotState().selectedFileName;
  }

  function setSelectedFileName(nextSelectedFileName) {
    setSnapshotState({
      ...getSnapshotState(),
      selectedFileName: nextSelectedFileName,
    });
  }

  function selectTask(fileName) {
    setSelectedFileName(fileName);
    const didRenderTask = dataRenderers.renderSelectedTask(getSnapshotState());
    if (!didRenderTask) return false;
    renderList();
    renderTaskPool();
    renderRecommendationRun();
    return true;
  }

  return {
    getSelectedFileName,
    selectTask,
    setSelectedFileName,
  };
}
