import { createAutoMergeReplanActionDefinition } from "./auto-merge-replan-action-definition.js";

export function createManualWorkflowActionDefinitions({
  repositoryDir,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  findAcceptableTaskContextPackage,
  findAutoMergePlannablePackage,
  findGuidableConvergenceDecisionPackage,
  findCancellableHumanDecisionPackage,
  applyAppendRequest,
  acceptConvergenceAction,
  replanAutoMergeAction,
  continueConvergenceAction,
  cancelTaskAction,
  createReplanAutoMergeDefinition = createAutoMergeReplanActionDefinition,
}) {
  const replanAutoMerge = createReplanAutoMergeDefinition({
    repositoryDir,
    findAutoMergePlannablePackage,
    applyAppendRequest,
    replanAutoMergeAction,
  });

  return {
    acceptConvergenceSuccess({ packageId = null } = {}) {
      return {
        actionType: "accept_convergence_success",
        packageId,
        findTaskContextPackage: findAcceptableTaskContextPackage,
        unavailableResponse: { accepted: false },
        missingPackageMessage: (id) => `没有找到可接受的任务上下文包：${id}`,
        missingDefaultMessage: "没有可接受的任务上下文包。",
        run: ({ taskContextPackage, recommendationRun }) => acceptConvergenceAction({
          taskContextPackage,
          recommendationRun,
          repositoryDir,
          applyAppendRequest,
        }),
      };
    },

    replanAutoMerge,

    continueConvergenceWithGuidance({
      packageId = null,
      guidance = "",
      focusAreas = [],
      avoidRepeating = [],
      expectedNextOutcome = "",
    } = {}) {
      return {
        actionType: "continue_convergence_with_guidance",
        packageId,
        findTaskContextPackage: findGuidableConvergenceDecisionPackage,
        unavailableResponse: { continued: false },
        missingPackageMessage: (id) => `没有找到可带意见继续收敛的任务上下文包：${id}`,
        missingDefaultMessage: "没有可带意见继续收敛的任务上下文包。",
        run: ({ taskContextPackage, recommendationRun }) => continueConvergenceAction({
          taskContextPackage,
          recommendationRun,
          guidance,
          focusAreas,
          avoidRepeating,
          expectedNextOutcome,
          runExecutionAgentSession,
          runReviewAgentSession,
          runConvergenceSession,
          repositoryDir,
          applyAppendRequest,
        }),
      };
    },

    cancelTask({ packageId = null } = {}) {
      return {
        actionType: "cancel_task",
        packageId,
        findTaskContextPackage: findCancellableHumanDecisionPackage,
        unavailableResponse: { cancelled: false },
        missingPackageMessage: (id) => `没有找到可取消的任务上下文包：${id}`,
        missingDefaultMessage: "没有可取消的任务上下文包。",
        run: ({ taskContextPackage, recommendationRun }) => cancelTaskAction({
          taskContextPackage,
          recommendationRun,
          repositoryDir,
          applyAppendRequest,
        }),
      };
    },
  };
}
