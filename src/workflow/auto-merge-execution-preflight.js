import { existsSync } from "node:fs";
import {
  changedFilesInWorktree,
  repositoryChangedFiles,
  resolveWorktreePath,
  runGit,
} from "./git-worktree-state.js";
import { autoMergeReason } from "./auto-merge-reason.js";
import { artifactBody } from "./task-package-artifacts.js";

const defaultGit = {
  changedFilesInWorktree,
  repositoryChangedFiles,
  resolveWorktreePath,
  runGit,
};

export function resolveAutoMergeExecutionPreflight({
  taskContextPackage,
  repositoryDir = process.cwd(),
  fsExists = existsSync,
  git = defaultGit,
} = {}) {
  const plan = artifactBody(taskContextPackage, "autoMergePlan");
  const isolatedWorkspace = artifactBody(taskContextPackage, "isolatedWorkspace");
  const worktreePath = plan.source?.worktreePath ?? isolatedWorkspace.worktreePath;
  const absoluteWorktreePath = git.resolveWorktreePath(worktreePath, repositoryDir);
  if (!absoluteWorktreePath || !fsExists(absoluteWorktreePath)) {
    return {
      preflight: null,
      reasons: [autoMergeReason("WORKTREE_MISSING", "隔离工作树不存在。")],
    };
  }

  let activeBranch;
  let targetCommit;
  let mainChangedFiles;
  let worktreeChangedFiles;
  try {
    activeBranch = git.runGit(["branch", "--show-current"], { cwd: repositoryDir });
    targetCommit = git.runGit(["rev-parse", plan.target.branchName], { cwd: repositoryDir });
    mainChangedFiles = git.repositoryChangedFiles(repositoryDir);
    worktreeChangedFiles = git.changedFilesInWorktree(absoluteWorktreePath);
  } catch (error) {
    return {
      preflight: null,
      reasons: [autoMergeReason("GIT_CHECK_FAILED", error.message)],
    };
  }

  if (activeBranch !== plan.target.branchName) {
    return {
      preflight: null,
      reasons: [autoMergeReason("TARGET_NOT_CHECKED_OUT", "目标分支不是主工作树当前分支。")],
    };
  }

  if (targetCommit !== plan.target.currentCommit) {
    return {
      preflight: null,
      reasons: [autoMergeReason("TARGET_MOVED", "目标分支已经不在自动合并计划记录的 commit。")],
    };
  }

  if (mainChangedFiles.length > 0) {
    return {
      preflight: null,
      reasons: [autoMergeReason("MAIN_WORKTREE_DIRTY", "主工作区存在未提交变更。")],
    };
  }

  return {
    preflight: {
      plan,
      worktreePath,
      absoluteWorktreePath,
      targetCommit,
      worktreeChangedFiles,
    },
    reasons: [],
  };
}
