import { replanAutoMergeAction } from "./workflow-page-auto-merge-replan-action.js";

export function createWorkflowPageAutoMergeReplanCommand({
  workflowApi,
  activeTaskContextPackage,
  setRecommendationRun,
  renderRecommendationRun,
  loadTasks,
  pageStatus,
} = {}) {
  async function replanAutoMerge(actionButton = null) {
    return replanAutoMergeAction({
      workflowApi,
      activeTaskContextPackage,
      setAutoMergeStatus: pageStatus.setAutoMergeStatus,
      setRecommendationRun,
      renderRecommendationRun,
      loadTasks,
      actionButton,
    });
  }

  return {
    replanAutoMerge,
  };
}
