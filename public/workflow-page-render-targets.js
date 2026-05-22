export function createWorkflowSectionRenderTargets(elements) {
  return {
    humanDecision: {
      status: elements.humanDecisionStatus,
      inputs: elements.humanDecisionInputs,
      raw: elements.humanDecisionRaw,
      panel: elements.humanDecisionPanel,
    },
    autoMerge: {
      status: elements.autoMergeStatus,
      inputs: elements.autoMergeInputs,
      raw: elements.autoMergeRaw,
      panel: elements.autoMergePanel,
    },
    autoMergeExecution: {
      status: elements.autoMergeExecutionStatus,
      inputs: elements.autoMergeExecutionInputs,
      raw: elements.autoMergeExecutionRaw,
      panel: elements.autoMergeExecutionPanel,
    },
    taskCloseout: {
      status: elements.taskCloseoutStatus,
      inputs: elements.taskCloseoutInputs,
      raw: elements.taskCloseoutRaw,
      panel: elements.taskCloseoutPanel,
    },
    stageTimeline: {
      status: elements.stageTimelineStatus,
      panel: elements.stageTimelinePanel,
    },
  };
}

export function createRecommendationRunRenderTargets(elements) {
  return {
    recommendationResult: elements.recommendationResult,
    recommendationIntentPanel: elements.recommendationIntentPanel,
    admissionPanel: elements.admissionPanel,
    taskContextPackagePanel: elements.taskContextPackagePanel,
    taskContextPackageRaw: elements.taskContextPackageRaw,
    recommendationRaw: elements.recommendationRaw,
    recommendationTerminal: elements.recommendationTerminal,
    admissionRaw: elements.admissionRaw,
    recommendationInputs: elements.recommendationInputs,
    admissionInputs: elements.admissionInputs,
    runRecommendationButton: elements.runRecommendationButton,
    runWorkflowButton: elements.runWorkflowButton,
    cancelRecommendationButton: elements.cancelRecommendationButton,
    recommendationStatus: elements.recommendationStatus,
    admissionStatus: elements.admissionStatus,
    taskContextPackageStatus: elements.taskContextPackageStatus,
    humanDecisionStatus: elements.humanDecisionStatus,
    humanDecisionRaw: elements.humanDecisionRaw,
    humanDecisionPanel: elements.humanDecisionPanel,
    autoMergeStatus: elements.autoMergeStatus,
    autoMergeRaw: elements.autoMergeRaw,
    autoMergePanel: elements.autoMergePanel,
    autoMergeExecutionStatus: elements.autoMergeExecutionStatus,
    autoMergeExecutionRaw: elements.autoMergeExecutionRaw,
    autoMergeExecutionPanel: elements.autoMergeExecutionPanel,
    taskCloseoutStatus: elements.taskCloseoutStatus,
    taskCloseoutRaw: elements.taskCloseoutRaw,
    taskCloseoutPanel: elements.taskCloseoutPanel,
  };
}
