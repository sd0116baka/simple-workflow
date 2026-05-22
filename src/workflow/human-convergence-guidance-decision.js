import { buildHumanConvergenceGuidanceRequest } from "./human-decision-action-append.js";
import { resolvePendingHumanDecisionRequest } from "./human-decision-request-guard.js";

export function provideHumanConvergenceGuidance({
  taskContextPackage,
  guidance,
  focusAreas = [],
  avoidRepeating = [],
  expectedNextOutcome = "",
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  const pendingDecision = resolvePendingHumanDecisionRequest({
    taskContextPackage,
    actionLabel: "追加人工收敛意见",
    requiredOption: "continue-convergence-with-guidance",
    missingTargetError: "任务上下文包缺少人工决策请求指向的目标产物，不能追加人工收敛意见。",
    mismatchedTargetError: "人工决策请求没有指向当前目标产物，不能追加人工收敛意见。",
  });
  if (pendingDecision.error) {
    return {
      appendRequest: null,
      error: pendingDecision.error,
    };
  }
  const normalizedGuidance = String(guidance ?? "").trim();
  if (!normalizedGuidance) {
    return {
      appendRequest: null,
      error: "人工收敛意见不能为空。",
    };
  }

  return {
    appendRequest: buildHumanConvergenceGuidanceRequest({
      taskContextPackage,
      decisionTarget: pendingDecision.decisionTarget,
      guidance: normalizedGuidance,
      focusAreas,
      avoidRepeating,
      expectedNextOutcome,
      decidedAt: now(),
    }),
    error: null,
  };
}
