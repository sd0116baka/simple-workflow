import { existsSync } from "node:fs";
import { normalizePathForGit } from "./git-path.js";
import {
  changedFilesInWorktree,
  diffChangedFiles,
  isAncestor,
  resolveWorktreePath,
  runGit,
} from "./git-worktree-state.js";
import { autoMergeReason } from "./auto-merge-reason.js";
import { artifactBody } from "./task-package-artifacts.js";

const defaultGit = {
  changedFilesInWorktree,
  diffChangedFiles,
  isAncestor,
  resolveWorktreePath,
  runGit,
};

export function resolveAutoMergePlanningInputs({
  taskContextPackage,
  repositoryDir = process.cwd(),
  targetBranch = "main",
  fsExists = existsSync,
  git = defaultGit,
} = {}) {
  const humanDecision = artifactBody(taskContextPackage, "humanDecision");
  const isolatedWorkspace = artifactBody(taskContextPackage, "isolatedWorkspace");
  const worktreePath = humanDecision.acceptedWork?.worktreePath
    ?? isolatedWorkspace.worktreePath;
  const absoluteWorktreePath = git.resolveWorktreePath(worktreePath, repositoryDir);
  if (!absoluteWorktreePath || !fsExists(absoluteWorktreePath)) {
    return {
      planningInputs: null,
      reasons: [autoMergeReason("WORKTREE_MISSING", "隔离工作树不存在。")],
    };
  }

  try {
    const worktreeHead = git.runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath });
    const targetCommit = git.runGit(["rev-parse", targetBranch], { cwd: repositoryDir });
    const changedFiles = git.changedFilesInWorktree(absoluteWorktreePath);

    const acceptedBase = humanDecision.acceptedWork?.baseCommit;
    const worktreeHeadMatchesAcceptedBase = worktreeHead === acceptedBase;
    const worktreeContainsAcceptedWork = worktreeHeadMatchesAcceptedBase
      || git.isAncestor(acceptedBase, worktreeHead, absoluteWorktreePath);
    if (!worktreeContainsAcceptedWork) {
      return {
        planningInputs: null,
        reasons: [
          autoMergeReason("WORKTREE_HEAD_MISMATCH", "隔离工作树 HEAD 不包含人工接受时的 baseCommit。"),
        ],
      };
    }

    const committedChangedFiles = worktreeHeadMatchesAcceptedBase
      ? []
      : git.diffChangedFiles(acceptedBase, worktreeHead, absoluteWorktreePath);
    const planChangedFiles = changedFiles.length > 0
      ? changedFiles
      : committedChangedFiles;

    if (planChangedFiles.length === 0) {
      return {
        planningInputs: null,
        reasons: [autoMergeReason("NO_CHANGES", "隔离工作树没有可合并变更。")],
      };
    }

    return {
      planningInputs: {
        source: {
          worktreePath: normalizePathForGit(worktreePath),
          branchName: humanDecision.acceptedWork?.branchName ?? isolatedWorkspace.branchName,
          baseCommit: acceptedBase,
          currentCommit: worktreeHead,
        },
        target: {
          branchName: targetBranch,
          currentCommit: targetCommit,
        },
        changedFiles: planChangedFiles,
        worktreeHeadMatchesAcceptedBase,
      },
      reasons: [],
    };
  } catch (error) {
    return {
      planningInputs: null,
      reasons: [autoMergeReason("GIT_CHECK_FAILED", error.message)],
    };
  }
}
