import { createRecommendationRunControllerRegistry } from "./recommendation-run-controller-registry.js";
import { createRecommendationRunCompletion } from "./recommendation-run-completion.js";
import { createRecommendationRunLifecycleState } from "./recommendation-run-lifecycle-state.js";
import { cancelRecommendationRunTransaction } from "./recommendation-run-cancellation.js";
import { createRecommendationRunTransaction } from "./recommendation-run-creation.js";
import { canContinueRecommendationRunDownstream } from "./recommendation-run-downstream-continuation.js";
import { createRecommendationRunProgressRecorder } from "./recommendation-run-progress-log.js";
import { normalizeWorkflowStageSwitches } from "./workflow-stage-switches.js";

export function createRecommendationRunLifecycle({
  tasksDir,
  repositoryDir,
  recommendationPromptPath,
  taskContextWorkspace,
  getStartupCheck,
  persistTaskContextPackage,
  applyAppendRequest,
  transitionCurrentWorkStage,
  runRecommendationCommand,
  runMainAgentSession,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  emitRecommendationChanged,
  progressLogStore = null,
  recommendationRunControllerRegistry = createRecommendationRunControllerRegistry(),
  recommendationRunLifecycleState = createRecommendationRunLifecycleState(),
}) {
  const progressRecorder = createRecommendationRunProgressRecorder({
    progressLogStore,
    emitRecommendationChanged,
  });
  const recommendationRunCompletion = createRecommendationRunCompletion({
    tasksDir,
    repositoryDir,
    taskContextWorkspace,
    getStartupCheck,
    getLatestRecommendationRun,
    persistTaskContextPackage,
    applyAppendRequest,
    transitionCurrentWorkStage,
    runMainAgentSession,
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    recommendationRunControllerRegistry,
    emitRecommendationChanged,
    progressRecorder,
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
      progressRecorder,
    });
  }

  function cancelRecommendationRun() {
    return cancelRecommendationRunTransaction({
      recommendationRunLifecycleState,
      recommendationRunControllerRegistry,
      emitRecommendationChanged,
      progressRecorder,
    });
  }

  function updateRecommendationRunStageSwitches({ stageSwitches } = {}) {
    const run = getLatestRecommendationRun();
    if (!run) {
      return { updated: false, recommendationRun: null };
    }

    run.stageSwitches = normalizeWorkflowStageSwitches(stageSwitches);
    progressRecorder.recordSystemEvent(run, {
      type: "stage_switches_updated",
      message: "流程实时开关已更新。",
      stageSwitches: run.stageSwitches,
    });
    emitRecommendationChanged(run);
    if (canContinueRecommendationRunDownstream(run)) {
      run.status = "running";
      run.finishedAt = null;
      progressRecorder.recordSystemEvent(run, {
        type: "downstream_continuation_started",
        message: "实时开关允许后续流程继续执行。",
      });
      emitRecommendationChanged(run);
      const appendProgress = (progress) => {
        progressRecorder.appendProgress(run, progress);
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
    recordRecommendationRunSystemEvent(run, event) {
      progressRecorder.recordSystemEvent(run, event);
    },
    readRecommendationRunProgressLog(runId) {
      return {
        runId,
        events: progressLogStore?.read(runId) ?? [],
      };
    },
  };
}
