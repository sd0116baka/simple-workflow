import { renderRecommendationRunTaskContext } from "./recommendation-run-task-context-renderer.js";

function applyTextState(elements, state) {
  for (const [name, value] of Object.entries(state)) {
    if (elements[name]) elements[name].textContent = value;
  }
}

function buildRecommendationRunEmptyState(viewModel) {
  return {
    recommendationStatus: viewModel.recommendationStatus,
    admissionStatus: viewModel.admissionStatus,
    recommendationResult: viewModel.recommendationResultText,
    recommendationIntentPanel: viewModel.recommendationIntentText,
    admissionPanel: viewModel.admissionPanelText,
    taskContextPackageStatus: "等待输入",
    taskContextPackageRaw: "等待执行准入器输出。",
    taskContextPackagePanel: "等待执行准入器输出。",
    humanDecisionStatus: "等待输入",
    humanDecisionRaw: "尚未请求人工决策。",
    humanDecisionPanel: "等待收敛成功证据。",
    autoMergeStatus: "等待输入",
    autoMergeRaw: "尚未进入自动合并环节。",
    autoMergePanel: "等待人工接受收敛成功。",
    autoMergeExecutionStatus: "等待输入",
    autoMergeExecutionRaw: "尚未执行自动合并。",
    autoMergeExecutionPanel: "等待合并计划。",
    taskCloseoutStatus: "等待输入",
    taskCloseoutRaw: "尚未收尾。",
    taskCloseoutPanel: "等待自动合并结果。",
  };
}

export function renderRecommendationRunNoRunState({
  elements,
  viewModel,
  taskContextPackage,
  workflowPanelRenderers,
}) {
  const emptyState = buildRecommendationRunEmptyState(viewModel);
  applyTextState(elements, {
    recommendationStatus: emptyState.recommendationStatus,
    admissionStatus: emptyState.admissionStatus,
    recommendationResult: emptyState.recommendationResult,
    recommendationIntentPanel: emptyState.recommendationIntentPanel,
    admissionPanel: emptyState.admissionPanel,
  });

  renderRecommendationRunTaskContext({
    elements,
    taskContextPackage,
    workflowPanelRenderers,
    emptyState,
  });

  if (taskContextPackage) return emptyState;

  applyTextState(elements, {
    humanDecisionStatus: emptyState.humanDecisionStatus,
    humanDecisionRaw: emptyState.humanDecisionRaw,
    humanDecisionPanel: emptyState.humanDecisionPanel,
    autoMergeStatus: emptyState.autoMergeStatus,
    autoMergeRaw: emptyState.autoMergeRaw,
    autoMergePanel: emptyState.autoMergePanel,
    autoMergeExecutionStatus: emptyState.autoMergeExecutionStatus,
    autoMergeExecutionRaw: emptyState.autoMergeExecutionRaw,
    autoMergeExecutionPanel: emptyState.autoMergeExecutionPanel,
    taskCloseoutStatus: emptyState.taskCloseoutStatus,
    taskCloseoutRaw: emptyState.taskCloseoutRaw,
    taskCloseoutPanel: emptyState.taskCloseoutPanel,
  });

  return emptyState;
}
