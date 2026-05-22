import { WorkflowApiError } from "./workflow-api-client.js";
import {
  beginActionFeedback,
  findActionFeedbackTarget,
  resetActionFeedback,
  setFeedbackText,
} from "./workflow-action-feedback.js";
import { syncManualActionRecommendationRun } from "./workflow-page-manual-action-runner.js";

export async function replanAutoMergeAction({
  workflowApi,
  activeTaskContextPackage,
  setAutoMergeStatus,
  setRecommendationRun,
  renderRecommendationRun,
  loadTasks,
  actionButton = null,
} = {}) {
  const taskContextPackage = activeTaskContextPackage();
  const feedback = findActionFeedbackTarget(actionButton, {
    panelSelector: ".auto-merge-panel",
    feedbackSelector: "[data-feedback='replan-auto-merge']",
  });
  beginActionFeedback(actionButton, { text: "规划中", pending: true });
  setFeedbackText(feedback, "正在重新扫描隔离工作树...");
  setAutoMergeStatus("规划中");

  let payload;
  try {
    payload = await workflowApi.replanAutoMerge({
      packageId: taskContextPackage?.packageId ?? null,
    });
  } catch (error) {
    const message = error instanceof WorkflowApiError
      ? error.message
      : `重新生成合并计划失败：${error.message}`;
    setAutoMergeStatus("规划失败");
    setFeedbackText(feedback, message);
    resetActionFeedback(actionButton, { text: "重新生成合并计划" });
    return { ok: false, error };
  }

  await syncManualActionRecommendationRun({
    payload,
    setRecommendationRun,
    renderRecommendationRun,
    loadTasks,
  });
  return { ok: true, payload };
}
