import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { normalizePathForGit } from "./git-path.js";
import {
  gitSucceeds,
  isPathInside,
  listedWorktreePaths,
  resolveWorktreePath,
  runGit,
} from "./git-worktree-state.js";

const defaultFilesystem = {
  existsSync,
  rmSync,
};

const defaultGit = {
  gitSucceeds,
  isPathInside,
  listedWorktreePaths,
  resolveWorktreePath,
  runGit,
};

export function removeWorkspaceAndBranch({
  repositoryDir,
  worktreePath,
  branchName,
  filesystem = defaultFilesystem,
  git = defaultGit,
  pathResolve = resolve,
} = {}) {
  const absoluteWorktreePath = git.resolveWorktreePath(worktreePath, repositoryDir);
  if (!absoluteWorktreePath) {
    return {
      error: "隔离工作树路径为空，不能收尾。",
    };
  }

  if (filesystem.existsSync(absoluteWorktreePath)) {
    const isRegisteredWorktree = git.listedWorktreePaths(repositoryDir)
      .includes(pathResolve(absoluteWorktreePath));
    if (isRegisteredWorktree) {
      git.runGit(["worktree", "remove", "--force", normalizePathForGit(absoluteWorktreePath)], {
        cwd: repositoryDir,
      });
    } else {
      const worktreeRoot = pathResolve(repositoryDir, ".workflow", "worktrees");
      if (!git.isPathInside(worktreeRoot, absoluteWorktreePath)) {
        return {
          error: "残留目录不在 .workflow/worktrees 下，不能自动删除。",
        };
      }
      filesystem.rmSync(absoluteWorktreePath, { recursive: true, force: true });
    }
  }

  git.runGit(["worktree", "prune"], { cwd: repositoryDir });
  if (branchName && git.gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
    cwd: repositoryDir,
  })) {
    git.runGit(["branch", "-D", branchName], { cwd: repositoryDir });
  }
  const branchStillExists = branchName
    ? git.gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
        cwd: repositoryDir,
      })
    : false;
  if (filesystem.existsSync(absoluteWorktreePath) || branchStillExists) {
    return {
      error: "执行侧资源未清理干净，不能完成取消或收尾。",
    };
  }

  return { error: null };
}
