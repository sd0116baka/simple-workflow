import { beginActionFeedback } from "./workflow-action-feedback.js";

export async function syncManualActionRecommendationRun({
  payload,
  setRecommendationRun,
  renderRecommendationRun,
  loadTasks,
}) {
  setRecommendationRun(payload.recommendationRun, { syncTaskPackage: true });
  renderRecommendationRun();
  await loadTasks();
}

export async function runManualWorkflowAction({
  workflowApi,
  activeTaskContextPackage,
  setStatus,
  setRecommendationRun,
  renderRecommendationRun,
  loadTasks,
  actionButton = null,
  feedbackText,
  statusText,
  run,
} = {}) {
  const taskContextPackage = activeTaskContextPackage();
  beginActionFeedback(actionButton, { text: feedbackText });
  setStatus(statusText);
  const payload = await run({
    workflowApi,
    packageId: taskContextPackage?.packageId ?? null,
  });
  await syncManualActionRecommendationRun({
    payload,
    setRecommendationRun,
    renderRecommendationRun,
    loadTasks,
  });
  return payload;
}
