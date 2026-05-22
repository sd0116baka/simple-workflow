import {
  diffChangedFiles,
  isAncestor,
  runGit,
  stagedChangedFiles,
} from "./git-worktree-state.js";
import { autoMergeReason } from "./auto-merge-reason.js";

const defaultGit = {
  diffChangedFiles,
  isAncestor,
  runGit,
  stagedChangedFiles,
};

function autoMergeCommitMessage(taskContextPackage) {
  const taskId = taskContextPackage?.taskDraft?.id ?? taskContextPackage?.packageId ?? "task";
  const taskName = taskContextPackage?.taskDraft?.name ?? "自动合并任务成果";
  return `chore(auto-merge): ${taskId} ${taskName}`;
}

export function runAutoMergeExecutionTransaction({
  taskContextPackage,
  repositoryDir = process.cwd(),
  plan,
  absoluteWorktreePath,
  targetCommit,
  worktreeChangedFiles = [],
  git = defaultGit,
} = {}) {
  let sourceCommit;
  let afterCommit;
  let sourceRebased = false;
  let mergedChangedFiles = worktreeChangedFiles;

  try {
    sourceCommit = git.runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath });
    if (worktreeChangedFiles.length > 0) {
      git.runGit(["add", "-A"], { cwd: absoluteWorktreePath });
      const stagedFiles = git.stagedChangedFiles(absoluteWorktreePath);
      if (stagedFiles.length === 0) {
        return {
          transaction: null,
          reasons: [autoMergeReason("NO_STAGED_CHANGES", "隔离工作树没有可提交的暂存变更。")],
        };
      }
      git.runGit([
        "-c",
        "user.name=Simple Workflow",
        "-c",
        "user.email=simple-workflow@example.invalid",
        "commit",
        "-m",
        autoMergeCommitMessage(taskContextPackage),
      ], { cwd: absoluteWorktreePath });
      sourceCommit = git.runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath });
    }

    if (worktreeChangedFiles.length === 0 && sourceCommit === plan.source.baseCommit) {
      return {
        transaction: null,
        reasons: [autoMergeReason("NO_CHANGES", "隔离工作树没有可提交变更。")],
      };
    }

    if (!git.isAncestor(targetCommit, sourceCommit, repositoryDir)) {
      git.runGit(["rebase", targetCommit], { cwd: absoluteWorktreePath });
      sourceCommit = git.runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath });
      sourceRebased = true;
    }

    mergedChangedFiles = worktreeChangedFiles.length > 0
      ? worktreeChangedFiles
      : git.diffChangedFiles(targetCommit, sourceCommit, repositoryDir);
    git.runGit(["merge", "--ff-only", sourceCommit], { cwd: repositoryDir });
    afterCommit = git.runGit(["rev-parse", plan.target.branchName], { cwd: repositoryDir });

    return {
      transaction: {
        sourceCommit,
        afterCommit,
        mergedChangedFiles,
        sourceRebased,
      },
      reasons: [],
    };
  } catch (error) {
    try {
      git.runGit(["rebase", "--abort"], { cwd: absoluteWorktreePath });
    } catch {
      // No rebase in progress.
    }
    return {
      transaction: null,
      reasons: [autoMergeReason("AUTO_MERGE_FAILED", error.message)],
    };
  }
}
