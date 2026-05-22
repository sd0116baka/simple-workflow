import {
  acceptConvergenceAndRunAutoMerge,
  replanAcceptedAutoMerge,
} from "./auto-merge-action.js";
import { continueConvergenceWithHumanGuidance } from "./human-convergence-action.js";
import { createManualWorkflowActionDefinitions } from "./manual-workflow-action-definitions.js";
import { createManualWorkflowActionProtocol } from "./manual-workflow-action-protocol.js";
import { createManualWorkflowActionRuntime } from "./manual-workflow-action-runtime.js";
import { cancelTaskFromHumanDecision } from "./task-cancellation-action.js";

export function createManualWorkflowActionService({
  repositoryDir,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  recommendationRunLifecycle,
  findAcceptableTaskContextPackage,
  findAutoMergePlannablePackage,
  findGuidableConvergenceDecisionPackage,
  findCancellableHumanDecisionPackage,
  applyAppendRequest,
  emitRecommendationChanged,
  acceptConvergenceAction = acceptConvergenceAndRunAutoMerge,
  replanAutoMergeAction = replanAcceptedAutoMerge,
  continueConvergenceAction = continueConvergenceWithHumanGuidance,
  cancelTaskAction = cancelTaskFromHumanDecision,
}) {
  const actionProtocol = createManualWorkflowActionProtocol({
    recommendationRunLifecycle,
    emitRecommendationChanged,
  });
  const actionDefinitions = createManualWorkflowActionDefinitions({
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
  });

  return createManualWorkflowActionRuntime({
    actionDefinitions,
    actionProtocol,
  });
}
