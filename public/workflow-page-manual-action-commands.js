import {
  acceptConvergenceAction,
  cancelTaskAction,
  continueConvergenceWithGuidanceAction,
} from "./workflow-page-manual-actions.js";

export function createWorkflowPageManualActionCommands({
  workflowApi,
  activeTaskContextPackage,
  setRecommendationRun,
  renderRecommendationRun,
  loadTasks,
  pageStatus,
} = {}) {
  async function acceptConvergence(actionButton = null) {
    return acceptConvergenceAction({
      workflowApi,
      activeTaskContextPackage,
      setHumanDecisionStatus: pageStatus.setHumanDecisionStatus,
      setRecommendationRun,
      renderRecommendationRun,
      loadTasks,
      actionButton,
    });
  }

  async function continueConvergenceWithGuidance({
    guidance,
    expectedNextOutcome,
    actionButton = null,
  } = {}) {
    return continueConvergenceWithGuidanceAction({
      workflowApi,
      activeTaskContextPackage,
      setHumanDecisionStatus: pageStatus.setHumanDecisionStatus,
      setRecommendationRun,
      renderRecommendationRun,
      loadTasks,
      guidance,
      expectedNextOutcome,
      actionButton,
    });
  }

  async function cancelTask(actionButton = null) {
    return cancelTaskAction({
      workflowApi,
      activeTaskContextPackage,
      setHumanDecisionStatus: pageStatus.setHumanDecisionStatus,
      setRecommendationRun,
      renderRecommendationRun,
      loadTasks,
      actionButton,
    });
  }

  return {
    acceptConvergence,
    continueConvergenceWithGuidance,
    cancelTask,
  };
}
