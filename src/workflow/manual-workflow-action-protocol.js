import {
  ensureManualWorkflowActionRun,
} from "./recommendation-run-state.js";
import { toRecommendationSnapshot } from "./recommendation-run-snapshot.js";

export function latestRecommendationSnapshot(recommendationRunLifecycle) {
  return toRecommendationSnapshot(recommendationRunLifecycle.getLatestRecommendationRun());
}

export function missingManualWorkflowActionResponse({
  response,
  packageId,
  missingPackageMessage,
  missingDefaultMessage,
  recommendationRunLifecycle,
}) {
  return {
    ...response,
    error: packageId ? missingPackageMessage(packageId) : missingDefaultMessage,
    recommendationRun: latestRecommendationSnapshot(recommendationRunLifecycle),
  };
}

export function createManualWorkflowActionProtocol({
  recommendationRunLifecycle,
  emitRecommendationChanged,
}) {
  function ensureLatestRecommendationRun(taskContextPackage) {
    recommendationRunLifecycle.setLatestRecommendationRun(
      ensureManualWorkflowActionRun(recommendationRunLifecycle.getLatestRecommendationRun(), {
        taskContextPackage,
      }),
    );
    return recommendationRunLifecycle.getLatestRecommendationRun();
  }

  function finishAction(action) {
    if (action.shouldEmit) {
      emitRecommendationChanged(recommendationRunLifecycle.getLatestRecommendationRun());
    }
    return {
      ...action.response,
      recommendationRun: latestRecommendationSnapshot(recommendationRunLifecycle),
    };
  }

  async function runManualWorkflowAction({
    actionType = "manual",
    packageId = null,
    findTaskContextPackage,
    isUnavailable = (taskContextPackage) => !taskContextPackage,
    unavailableResponse,
    missingPackageMessage,
    missingDefaultMessage,
    run,
  }) {
    const taskContextPackage = await findTaskContextPackage(packageId);
    if (isUnavailable(taskContextPackage)) {
      return missingManualWorkflowActionResponse({
        response: unavailableResponse,
        packageId,
        missingPackageMessage,
        missingDefaultMessage,
        recommendationRunLifecycle,
      });
    }

    const recommendationRun = ensureLatestRecommendationRun(taskContextPackage);
    recommendationRunLifecycle.recordRecommendationRunSystemEvent?.(recommendationRun, {
      type: "manual_action_started",
      message: "手动流程动作已启动。",
      actionType,
      packageId: taskContextPackage.packageId,
    });
    return finishAction(await run({ taskContextPackage, recommendationRun }));
  }

  return {
    finishAction,
    ensureLatestRecommendationRun,
    runManualWorkflowAction,
  };
}
