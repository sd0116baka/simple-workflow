import { runManualWorkflowAction } from "./workflow-page-manual-action-runner.js";

export async function acceptConvergenceAction({
  workflowApi,
  activeTaskContextPackage,
  setHumanDecisionStatus,
  setRecommendationRun,
  renderRecommendationRun,
  loadTasks,
  actionButton = null,
} = {}) {
  return runManualWorkflowAction({
    workflowApi,
    activeTaskContextPackage,
    setStatus: setHumanDecisionStatus,
    setRecommendationRun,
    renderRecommendationRun,
    loadTasks,
    actionButton,
    feedbackText: "提交中",
    statusText: "提交中",
    run: ({ workflowApi: api, packageId }) =>
      api.acceptConvergence({ packageId }),
  });
}

export async function continueConvergenceWithGuidanceAction({
  workflowApi,
  activeTaskContextPackage,
  setHumanDecisionStatus,
  setRecommendationRun,
  renderRecommendationRun,
  loadTasks,
  guidance,
  expectedNextOutcome,
  actionButton = null,
} = {}) {
  return runManualWorkflowAction({
    workflowApi,
    activeTaskContextPackage,
    setStatus: setHumanDecisionStatus,
    setRecommendationRun,
    renderRecommendationRun,
    loadTasks,
    actionButton,
    feedbackText: "继续中",
    statusText: "继续中",
    run: ({ workflowApi: api, packageId }) =>
      api.continueConvergenceWithGuidance({
        packageId,
        guidance,
        expectedNextOutcome,
      }),
  });
}

export async function cancelTaskAction({
  workflowApi,
  activeTaskContextPackage,
  setHumanDecisionStatus,
  setRecommendationRun,
  renderRecommendationRun,
  loadTasks,
  actionButton = null,
} = {}) {
  return runManualWorkflowAction({
    workflowApi,
    activeTaskContextPackage,
    setStatus: setHumanDecisionStatus,
    setRecommendationRun,
    renderRecommendationRun,
    loadTasks,
    actionButton,
    feedbackText: "取消中",
    statusText: "取消中",
    run: ({ workflowApi: api, packageId }) =>
      api.cancelTask({ packageId }),
  });
}
