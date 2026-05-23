import { createRecommendationRunControllerRegistry } from "./recommendation-run-controller-registry.js";
import { createRecommendationRunCompletion } from "./recommendation-run-completion.js";
import { createRecommendationRunLifecycleState } from "./recommendation-run-lifecycle-state.js";
import { cancelRecommendationRunTransaction } from "./recommendation-run-cancellation.js";
import { createRecommendationRunTransaction } from "./recommendation-run-creation.js";
import { canContinueRecommendationRunDownstream } from "./recommendation-run-downstream-continuation.js";
import { appendRecommendationRunProgress } from "./recommendation-run-progress.js";
import { normalizeWorkflowStageSwitches } from "./workflow-stage-switches.js";

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

  async function createRecommendationRun({ mode = "workflow", stageSwitches } = {}) {
    return createRecommendationRunTransaction({
      mode,
      stageSwitches,
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

  function updateRecommendationRunStageSwitches({ stageSwitches } = {}) {
    const run = getLatestRecommendationRun();
    if (!run) {
      return { updated: false, recommendationRun: null };
    }

    run.stageSwitches = normalizeWorkflowStageSwitches(stageSwitches);
    emitRecommendationChanged(run);
    if (canContinueRecommendationRunDownstream(run)) {
      run.status = "running";
      run.finishedAt = null;
      emitRecommendationChanged(run);
      const appendProgress = (progress) => {
        appendRecommendationRunProgress(run, progress);
        emitRecommendationChanged(run);
      };
      recommendationRunCompletion.continueRecommendationRun(run, appendProgress);
    }

    return {
      updated: true,
      recommendationRun: run,
    };
  }

  return {
    getLatestRecommendationRun,
    setLatestRecommendationRun,
    createRecommendationRun,
    cancelRecommendationRun,
    updateRecommendationRunStageSwitches,
  };
}
