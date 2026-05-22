import { WorkflowApiError } from "./workflow-api-client.js";
import {
  beginActionFeedback,
  updateActionFeedback,
} from "./workflow-action-feedback.js";

export async function startRecommendationRunAction({
  workflowApi,
  mode = "workflow",
  pendingText = "正在启动推荐器...",
  setRecommendationRun,
  renderRecommendationRun,
  setRecommendationStatus,
  setRecommendationResultText,
  runRecommendationButton,
  runWorkflowButton = null,
  cancelRecommendationButton = null,
} = {}) {
  beginActionFeedback(runRecommendationButton);
  if (runWorkflowButton && runWorkflowButton !== runRecommendationButton) {
    runWorkflowButton.disabled = true;
  }
  updateActionFeedback(cancelRecommendationButton, { hidden: true });
  setRecommendationStatus("启动中");
  setRecommendationResultText(pendingText);
  try {
    const payload = await workflowApi.startRecommendationRun({ mode });
    setRecommendationRun(payload.recommendationRun);
  } catch (error) {
    if (
      error instanceof WorkflowApiError
      && error.status === 409
      && error.payload?.recommendationRun
    ) {
      setRecommendationRun(error.payload.recommendationRun);
      renderRecommendationRun();
      return { ok: false, conflict: true, error };
    }
    throw error;
  }
  renderRecommendationRun();
  return { ok: true };
}

export async function cancelRecommendationRunAction({
  workflowApi,
  setRecommendationRun,
  renderRecommendationRun,
  cancelRecommendationButton = null,
} = {}) {
  if (!cancelRecommendationButton) return { ok: false, skipped: true };
  beginActionFeedback(cancelRecommendationButton, { text: "取消中" });
  const payload = await workflowApi.cancelRecommendationRun();
  setRecommendationRun(payload.recommendationRun);
  renderRecommendationRun();
  return { ok: true, payload };
}
