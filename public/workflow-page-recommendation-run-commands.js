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
  async function createRecommendationRun({ mode = "workflow" } = {}) {
    const isProbe = mode === "probe";
    return startRecommendationRunAction({
      workflowApi,
      mode,
      pendingText: isProbe ? "正在启动推荐探针..." : "正在启动完整 Agent 流程...",
      setRecommendationRun,
      renderRecommendationRun,
      setRecommendationStatus: pageStatus.setRecommendationStatus,
      setRecommendationResultText: pageStatus.setRecommendationResultText,
      runRecommendationButton: isProbe
        ? elements.runRecommendationButton
        : elements.runWorkflowButton ?? elements.runRecommendationButton,
      runWorkflowButton: isProbe ? elements.runWorkflowButton : elements.runRecommendationButton,
      cancelRecommendationButton: elements.cancelRecommendationButton,
    });
  }

  async function createWorkflowRun() {
    return createRecommendationRun({ mode: "workflow" });
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
    createWorkflowRun,
    cancelRecommendationRun,
  };
}
