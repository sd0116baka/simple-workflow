import {
  cancelRecommendationRunAction,
  startRecommendationRunAction,
} from "./workflow-page-recommendation-run-actions.js";

export function createWorkflowPageRecommendationRunCommands({
  workflowApi,
  setRecommendationRun,
  renderRecommendationRun,
  pageStatus,
  elements,
} = {}) {
  async function createRecommendationRun() {
    return startRecommendationRunAction({
      workflowApi,
      setRecommendationRun,
      renderRecommendationRun,
      setRecommendationStatus: pageStatus.setRecommendationStatus,
      setRecommendationResultText: pageStatus.setRecommendationResultText,
      runRecommendationButton: elements.runRecommendationButton,
      cancelRecommendationButton: elements.cancelRecommendationButton,
    });
  }

  async function cancelRecommendationRun() {
    return cancelRecommendationRunAction({
      workflowApi,
      setRecommendationRun,
      renderRecommendationRun,
      cancelRecommendationButton: elements.cancelRecommendationButton,
    });
  }

  return {
    createRecommendationRun,
    cancelRecommendationRun,
  };
}
