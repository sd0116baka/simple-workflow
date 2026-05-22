import { resetActionFeedback } from "./workflow-action-feedback.js";

function errorMessage(error) {
  return error?.message ?? String(error ?? "未知错误");
}

export function renderWorkflowPageError({
  elements,
  error,
} = {}) {
  const message = errorMessage(error);

  elements.selectedTitle.textContent = "读取失败";
  elements.selectedMeta.textContent = "请查看服务端日志。";
  elements.rawText.textContent = message;
  if (elements.parsedText) elements.parsedText.textContent = "";
  if (elements.validationResult) elements.validationResult.textContent = "";
  elements.startupCheckPanel.textContent = "";
  elements.parseStatus.textContent = "失败";
  if (elements.validationStatus) elements.validationStatus.textContent = "失败";
  elements.startupCheckStatus.textContent = "失败";
  elements.recommendationStatus.textContent = "失败";
  if (elements.humanDecisionStatus) elements.humanDecisionStatus.textContent = "失败";
  if (elements.recommendationResult) elements.recommendationResult.textContent = message;
  resetActionFeedback(elements.runRecommendationButton);
  resetActionFeedback(elements.seedStateFixturesButton, { text: "生成状态桩" });
  resetActionFeedback(elements.cleanupStateFixturesButton, { text: "清理状态桩" });
  resetActionFeedback(elements.cancelRecommendationButton, { text: "取消运行" });
}

export function createWorkflowPageErrorRenderer({
  elements,
} = {}) {
  return {
    render(error) {
      renderWorkflowPageError({ elements, error });
    },
  };
}
