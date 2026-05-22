import { relative } from "node:path";
import { normalizePathForGit } from "./git-path.js";
import { changedFilesInWorktree, resolveWorktreePath } from "./git-worktree-state.js";

const defaultGit = {
  changedFilesInWorktree,
  resolveWorktreePath,
};

export function resolveAcceptedWorktreeSnapshot({
  repositoryDir,
  worktreePath,
  git = defaultGit,
  pathRelative = relative,
  normalizePath = normalizePathForGit,
} = {}) {
  const cwd = git.resolveWorktreePath(worktreePath, repositoryDir);
  if (!cwd) {
    return {
      worktreeSnapshot: null,
      error: "任务上下文包缺少隔离工作树路径，不能接受收敛成功。",
    };
  }

  try {
    return {
      worktreeSnapshot: {
        cwd: normalizePath(pathRelative(repositoryDir, cwd)),
        changedFiles: git.changedFilesInWorktree(cwd),
      },
      error: null,
    };
  } catch (error) {
    return {
      worktreeSnapshot: null,
      error: `无法读取隔离工作树变更，不能接受收敛成功：${error.message}`,
    };
  }
}
