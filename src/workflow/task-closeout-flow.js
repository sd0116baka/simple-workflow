import {
  buildCancelledTaskCloseoutRequest,
  buildMergedTaskCloseoutRequest,
} from "./task-closeout-contract.js";
import { removeWorkspaceAndBranch } from "./task-closeout-cleanup-transaction.js";
import { artifactBody } from "./task-package-artifacts.js";

export function closeTask({
  taskContextPackage,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (taskContextPackage.currentWorkStage !== "merged") {
    return {
      appendRequest: null,
      error: "任务不在 merged 环节，不能收尾。",
    };
  }

  const autoMergeResult = artifactBody(taskContextPackage, "autoMergeResult");
  if (!autoMergeResult) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 autoMergeResult，不能收尾。",
    };
  }

  const isolatedWorkspace = artifactBody(taskContextPackage, "isolatedWorkspace");
  if (!isolatedWorkspace) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能收尾。",
    };
  }

  const sourceCommit = autoMergeResult.source?.commit;
  const targetCommit = autoMergeResult.target?.afterCommit;
  if (!sourceCommit || sourceCommit !== targetCommit) {
    return {
      appendRequest: null,
      error: "自动合并结果未证明任务分支成果已进入目标分支，不能删除任务分支。",
    };
  }

  const worktreePath = isolatedWorkspace.worktreePath;
  const branchName = isolatedWorkspace.branchName;
  try {
    const cleanup = removeWorkspaceAndBranch({ repositoryDir, worktreePath, branchName });
    if (cleanup.error) return { appendRequest: null, error: cleanup.error };
  } catch (error) {
    return {
      appendRequest: null,
      error: error.message,
    };
  }

  return {
    appendRequest: buildMergedTaskCloseoutRequest({
      taskContextPackage,
      closeoutAt: now(),
      worktreePath,
      branchName,
    }),
    error: null,
  };
}

export function closeCancelledTask({
  taskContextPackage,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (taskContextPackage.currentWorkStage !== "task-closeout") {
    return {
      appendRequest: null,
      error: "任务不在 task-closeout 环节，不能执行取消收尾。",
    };
  }
  const humanDecision = artifactBody(taskContextPackage, "humanDecision");
  if (humanDecision?.decision !== "cancel-task") {
    return {
      appendRequest: null,
      error: "任务缺少取消决策，不能执行取消收尾。",
    };
  }

  const isolatedWorkspace = artifactBody(taskContextPackage, "isolatedWorkspace");
  if (!isolatedWorkspace) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能执行取消收尾。",
    };
  }

  const worktreePath = isolatedWorkspace.worktreePath;
  const branchName = isolatedWorkspace.branchName;
  try {
    const cleanup = removeWorkspaceAndBranch({ repositoryDir, worktreePath, branchName });
    if (cleanup.error) return { appendRequest: null, error: cleanup.error };
  } catch (error) {
    return {
      appendRequest: null,
      error: error.message,
    };
  }

  return {
    appendRequest: buildCancelledTaskCloseoutRequest({
      taskContextPackage,
      closeoutAt: now(),
      worktreePath,
      branchName,
    }),
    error: null,
  };
}
