import { artifactRecord } from "./task-package-artifacts.js";

export function decisionMatchesRequest(decision, request) {
  if (!decision?.body || !request?.body) return false;
  if (request.body.targetType) {
    return decision.body.targetType === request.body.targetType
      && decision.body.targetRef === request.body.targetRef;
  }
  if (request.body.convergenceSuccessRef) {
    return decision.body.convergenceSuccessRef === request.body.convergenceSuccessRef
      && decision.body.decision === "accept-convergence";
  }
  if (request.body.targetRef) {
    return decision.body.targetRef === request.body.targetRef;
  }
  return false;
}

export function humanDecisionTargetLabel(request) {
  if (!request?.body) return "未生成";
  if (request.body.targetType) {
    return `${request.body.targetType}:${request.body.targetRef ?? "unknown"}`;
  }
  if (request.body.convergenceSuccessRef) {
    return `convergenceSuccess:${request.body.convergenceSuccessRef}`;
  }
  if (request.body.targetRef) {
    return request.body.targetRef;
  }
  return "未指定";
}

export function buildHumanDecisionPanelViewModel(taskContextPackage) {
  const request = artifactRecord(taskContextPackage, "humanDecisionRequest");
  const historicalDecision = artifactRecord(taskContextPackage, "humanDecision");
  const decision = decisionMatchesRequest(historicalDecision, request) ? historicalDecision : null;
  if (!request?.body && !historicalDecision?.body) return null;

  const isGuidanceRequest = request?.body?.decisionOptions?.includes("continue-convergence-with-guidance");
  const isConvergenceSuccessRequest = request?.body?.decisionOptions?.includes("accept-convergence");
  const hasPendingRequest = Boolean(request?.body && !decision?.body);
  const changedFiles = decision?.body?.worktreeSnapshot?.changedFiles ?? [];

  return {
    decision,
    request,
    title: decision?.body
      ? decision.body.decision === "cancel-task" ? "已取消任务" : "已接受收敛成功"
      : "等待人工决策",
    reason: decision?.body
      ? decision.body.decision === "cancel-task"
        ? "人工已决定取消任务，执行侧资源由任务收尾环节清理。"
        : "收敛成功证据已由人工接受，等待自动合并环节处理。"
      : request.body.reason ?? "需要人工确认下一步。",
    meta: decision?.body
      ? [
          `decision: ${decision.body.decision}`,
          `next: ${decision.body.nextRequiredStage}`,
          `decidedAt: ${decision.body.decidedAt ?? decision.appendedAt ?? "unknown"}`,
        ].join(" · ")
      : [
          `target: ${humanDecisionTargetLabel(request)}`,
          `requestedAt: ${request.body.requestedAt ?? request.appendedAt ?? "unknown"}`,
        ].join(" · "),
    badges: changedFiles.length > 0
      ? changedFiles
      : request?.body?.decisionOptions ?? [],
    guidanceForm: hasPendingRequest && isGuidanceRequest,
    actions: hasPendingRequest
      ? isGuidanceRequest
        ? isConvergenceSuccessRequest
          ? ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"]
          : ["continue-convergence-with-guidance", "cancel-task"]
        : ["accept-convergence"]
      : [],
  };
}
