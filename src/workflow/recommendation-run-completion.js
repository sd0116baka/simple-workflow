import { completeRecommendationFlow as completeFlow } from "./recommendation-flow.js";
import { loadRecommendationRunCompletionInput as loadCompletionInput } from "./recommendation-run-completion-inputs.js";
import {
  applyCompletedRecommendationRun as applyCompletedRun,
  applyFailedRecommendationRun as applyFailedRun,
} from "./recommendation-run-completion-outcome.js";
import { canContinueRecommendationRunDownstream } from "./recommendation-run-downstream-continuation.js";

export function createRecommendationRunCompletion({
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
  completeRecommendationFlow = completeFlow,
  loadRecommendationRunCompletionInput = loadCompletionInput,
  applyCompletedRecommendationRun = applyCompletedRun,
  applyFailedRecommendationRun = applyFailedRun,
  now = () => new Date().toISOString(),
}) {
  async function finishRecommendationRun(run, startedCommand, onProgress) {
    let shouldEmitChange = false;
    try {
      const result = await startedCommand;
      if (run.status === "cancelled") return;
      const completionInput = await loadRecommendationRunCompletionInput({
        run,
        commandResult: result,
        tasksDir,
        repositoryDir,
        taskContextWorkspace,
        getStartupCheck,
        getLatestRecommendationRun,
        runMainAgentSession,
        runExecutionAgentSession,
        runReviewAgentSession,
        runConvergenceSession,
        recommendationRunControllerRegistry,
        onProgress,
      });
      const completedRun = await completeRecommendationFlow(completionInput);
      const outcome = await applyCompletedRecommendationRun({
        run,
        completedRun,
        persistTaskContextPackage,
      });
      shouldEmitChange = outcome.applied;
      if (outcome.applied && canContinueRecommendationRunDownstream(run)) {
        run.status = "running";
        run.finishedAt = null;
        emitRecommendationChanged(run);
        await continueRecommendationRun(run, onProgress);
        shouldEmitChange = false;
      }
    } catch (error) {
      const outcome = applyFailedRecommendationRun({
        run,
        error,
        now,
      });
      shouldEmitChange = outcome.applied;
    } finally {
      recommendationRunControllerRegistry.delete(run.id);
    }
    if (shouldEmitChange) {
      emitRecommendationChanged(run);
    }
  }

  async function continueRecommendationRun(run, onProgress) {
    let shouldEmitChange = false;
    try {
      const commandResult = {
        stdout: run.stdout ?? "",
        stderr: run.stderr ?? "",
        exitCode: run.exitCode ?? null,
        error: run.error ?? null,
        terminalSessionId: run.terminalSessionId ?? null,
      };
      const completionInput = await loadRecommendationRunCompletionInput({
        run,
        commandResult,
        tasksDir,
        repositoryDir,
        taskContextWorkspace,
        getStartupCheck,
        getLatestRecommendationRun,
        runMainAgentSession,
        runExecutionAgentSession,
        runReviewAgentSession,
        runConvergenceSession,
        recommendationRunControllerRegistry,
        onProgress,
      });
      const completedRun = await completeRecommendationFlow({
        ...completionInput,
        mode: "workflow",
      });
      const outcome = await applyCompletedRecommendationRun({
        run,
        completedRun,
        persistTaskContextPackage,
      });
      shouldEmitChange = outcome.applied;
    } catch (error) {
      const outcome = applyFailedRecommendationRun({
        run,
        error,
        now,
      });
      shouldEmitChange = outcome.applied;
    }
    if (shouldEmitChange) {
      emitRecommendationChanged(run);
    }
    return run;
  }

  return {
    continueRecommendationRun,
    finishRecommendationRun,
  };
}
