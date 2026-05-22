import { createRecommendationRunControllerRegistry } from "./recommendation-run-controller-registry.js";
import { createRecommendationRunCompletion } from "./recommendation-run-completion.js";
import { createRecommendationRunLifecycleState } from "./recommendation-run-lifecycle-state.js";
import { cancelRecommendationRunTransaction } from "./recommendation-run-cancellation.js";
import { createRecommendationRunTransaction } from "./recommendation-run-creation.js";

export function createRecommendationRunLifecycle({
  tasksDir,
  repositoryDir,
  recommendationPromptPath,
  taskContextWorkspace,
  getStartupCheck,
  persistTaskContextPackage,
  runRecommendationCommand,
  runMainAgentSession,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  emitRecommendationChanged,
  recommendationRunControllerRegistry = createRecommendationRunControllerRegistry(),
  recommendationRunLifecycleState = createRecommendationRunLifecycleState(),
}) {
  const recommendationRunCompletion = createRecommendationRunCompletion({
    tasksDir,
    repositoryDir,
    taskContextWorkspace,
    getStartupCheck,
    getLatestRecommendationRun,
    persistTaskContextPackage,
    runMainAgentSession,
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    recommendationRunControllerRegistry,
    emitRecommendationChanged,
  });

  function setLatestRecommendationRun(run) {
    recommendationRunLifecycleState.setLatestRun(run);
  }

  function getLatestRecommendationRun() {
    return recommendationRunLifecycleState.getLatestRun();
  }

  async function createRecommendationRun({ mode = "workflow" } = {}) {
    return createRecommendationRunTransaction({
      mode,
      tasksDir,
      recommendationPromptPath,
      taskContextWorkspace,
      getStartupCheck,
      runRecommendationCommand,
      recommendationRunLifecycleState,
      recommendationRunControllerRegistry,
      recommendationRunCompletion,
      emitRecommendationChanged,
    });
  }

  function cancelRecommendationRun() {
    return cancelRecommendationRunTransaction({
      recommendationRunLifecycleState,
      recommendationRunControllerRegistry,
      emitRecommendationChanged,
    });
  }

  return {
    getLatestRecommendationRun,
    setLatestRecommendationRun,
    createRecommendationRun,
    cancelRecommendationRun,
  };
}
