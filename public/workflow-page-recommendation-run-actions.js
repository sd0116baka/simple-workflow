import { WorkflowApiError } from "./workflow-api-client.js";
import {
  beginActionFeedback,
  updateActionFeedback,
} from "./workflow-action-feedback.js";

export async function startRecommendationRunAction({
  workflowApi,
  setRecommendationRun,
  renderRecommendationRun,
  setRecommendationStatus,
  setRecommendationResultText,
  runRecommendationButton,
  cancelRecommendationButton = null,
} = {}) {
  beginActionFeedback(runRecommendationButton);
  updateActionFeedback(cancelRecommendationButton, { hidden: true });
  setRecommendationStatus("启动中");
  setRecommendationResultText("正在启动推荐器...");
  try {
    const payload = await workflowApi.startRecommendationRun();
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
