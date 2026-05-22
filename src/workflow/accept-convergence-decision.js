import { resolveAcceptedWorktreeSnapshot } from "./accepted-worktree-snapshot.js";
import { buildAcceptConvergenceDecisionRequest } from "./human-decision-action-append.js";
import { resolvePendingHumanDecisionRequest } from "./human-decision-request-guard.js";
import { artifactRecord } from "./task-package-artifacts.js";

export function acceptConvergenceSuccess({
  taskContextPackage,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  const pendingDecision = resolvePendingHumanDecisionRequest({
    taskContextPackage,
    actionLabel: "接受收敛成功",
    requiredTargetKind: "convergenceSuccess",
    requiredOption: "accept-convergence",
    missingRequestError: "任务上下文包缺少 humanDecisionRequest，不能接受收敛成功。",
    missingRequiredTargetError: "任务上下文包缺少 convergenceSuccess，不能接受收敛成功。",
    mismatchedTargetError: "人工决策请求没有指向当前 convergenceSuccess，不能接受收敛成功。",
    disallowedOptionError: "人工决策请求不允许接受收敛成功。",
  });
  if (pendingDecision.error) {
    return {
      appendRequest: null,
      error: pendingDecision.error,
    };
  }
  const isolatedWorkspace = artifactRecord(taskContextPackage, "isolatedWorkspace");
  if (!isolatedWorkspace?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能接受收敛成功。",
    };
  }

  const snapshot = resolveAcceptedWorktreeSnapshot({
    repositoryDir,
    worktreePath: isolatedWorkspace.body.worktreePath,
  });
  if (snapshot.error) {
    return {
      appendRequest: null,
      error: snapshot.error,
    };
  }

  return {
    appendRequest: buildAcceptConvergenceDecisionRequest({
      taskContextPackage,
      convergenceSuccess: pendingDecision.decisionTarget.artifact,
      isolatedWorkspace,
      worktreeSnapshot: snapshot.worktreeSnapshot,
      decidedAt: now(),
    }),
    error: null,
  };
}
