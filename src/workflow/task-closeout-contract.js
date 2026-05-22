import { normalizePathForGit } from "./git-path.js";

function cleanupRecord({ worktreePath, branchName }) {
  return {
    worktree: {
      path: normalizePathForGit(worktreePath),
      removed: true,
    },
    branch: {
      name: branchName,
      deleted: true,
    },
  };
}

export function buildMergedTaskCloseoutRequest({
  taskContextPackage,
  closeoutAt,
  worktreePath,
  branchName,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "taskCloseout",
    artifact: {
      closeoutAt,
      closedAt: closeoutAt,
      closeoutReason: "merged",
      resultRef: "autoMergeResult",
      cleanup: cleanupRecord({ worktreePath, branchName }),
      finalStage: "closed",
    },
  };
}

export function buildCancelledTaskCloseoutRequest({
  taskContextPackage,
  closeoutAt,
  worktreePath,
  branchName,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "taskCloseout",
    artifact: {
      closeoutAt,
      closeoutReason: "cancelled",
      decisionRef: "humanDecision",
      cleanup: cleanupRecord({ worktreePath, branchName }),
      finalStage: "cancelled",
    },
  };
}
