import { buildCancelTaskDecisionRequest } from "./human-decision-action-append.js";
import { resolvePendingHumanDecisionRequest } from "./human-decision-request-guard.js";

export function cancelTaskAfterHumanDecisionRequest({
  taskContextPackage,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  const pendingDecision = resolvePendingHumanDecisionRequest({
    taskContextPackage,
    actionLabel: "取消任务",
    requiredOption: "cancel-task",
    missingTargetError: "任务上下文包缺少人工决策请求指向的目标产物，不能取消任务。",
    mismatchedTargetError: "人工决策请求没有指向当前目标产物，不能取消任务。",
  });
  if (pendingDecision.error) {
    return {
      appendRequest: null,
      error: pendingDecision.error,
    };
  }
  return {
    appendRequest: buildCancelTaskDecisionRequest({
      taskContextPackage,
      decisionTarget: pendingDecision.decisionTarget,
      decidedAt: now(),
    }),
    error: null,
  };
}
