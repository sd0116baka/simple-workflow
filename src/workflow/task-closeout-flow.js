import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

function runGit(args, { cwd }) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitSucceeds(args, { cwd }) {
  try {
    runGit(args, { cwd });
    return true;
  } catch {
    return false;
  }
}

function normalizePathForGit(filePath) {
  return filePath.replace(/\\/g, "/");
}

function resolveWorktreePath(worktreePath, repositoryDir) {
  if (!worktreePath) return null;
  return isAbsolute(worktreePath) ? worktreePath : resolve(repositoryDir, worktreePath);
}

function isPathInside(parentPath, childPath) {
  const parent = resolve(parentPath);
  const child = resolve(childPath);
  return child === parent || child.startsWith(`${parent}\\`) || child.startsWith(`${parent}/`);
}

function listedWorktreePaths(repositoryDir) {
  const output = runGit(["worktree", "list", "--porcelain"], { cwd: repositoryDir });
  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => resolve(line.slice("worktree ".length)));
}

export function removeWorkspaceAndBranch({ repositoryDir, worktreePath, branchName }) {
  const absoluteWorktreePath = resolveWorktreePath(worktreePath, repositoryDir);
  if (!absoluteWorktreePath) {
    return {
      error: "隔离工作树路径为空，不能收尾。",
    };
  }

  if (existsSync(absoluteWorktreePath)) {
    const isRegisteredWorktree = listedWorktreePaths(repositoryDir)
      .includes(resolve(absoluteWorktreePath));
    if (isRegisteredWorktree) {
      runGit(["worktree", "remove", "--force", normalizePathForGit(absoluteWorktreePath)], {
        cwd: repositoryDir,
      });
    } else {
      const worktreeRoot = resolve(repositoryDir, ".workflow", "worktrees");
      if (!isPathInside(worktreeRoot, absoluteWorktreePath)) {
        return {
          error: "残留目录不在 .workflow/worktrees 下，不能自动删除。",
        };
      }
      rmSync(absoluteWorktreePath, { recursive: true, force: true });
    }
  }
  runGit(["worktree", "prune"], { cwd: repositoryDir });
  if (branchName && gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
    cwd: repositoryDir,
  })) {
    runGit(["branch", "-D", branchName], { cwd: repositoryDir });
  }
  const branchStillExists = branchName
    ? gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
        cwd: repositoryDir,
      })
    : false;
  if (existsSync(absoluteWorktreePath) || branchStillExists) {
    return {
      error: "执行侧资源未清理干净，不能完成取消或收尾。",
    };
  }

  return { error: null };
}

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

  const autoMergeResult = taskContextPackage.artifacts?.autoMergeResult;
  if (!autoMergeResult?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 autoMergeResult，不能收尾。",
    };
  }

  const isolatedWorkspace = taskContextPackage.artifacts?.isolatedWorkspace;
  if (!isolatedWorkspace?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能收尾。",
    };
  }

  const sourceCommit = autoMergeResult.body.source?.commit;
  const targetCommit = autoMergeResult.body.target?.afterCommit;
  if (!sourceCommit || sourceCommit !== targetCommit) {
    return {
      appendRequest: null,
      error: "自动合并结果未证明任务分支成果已进入目标分支，不能删除任务分支。",
    };
  }

  const worktreePath = isolatedWorkspace.body.worktreePath;
  const branchName = isolatedWorkspace.body.branchName;
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
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "taskCloseout",
      artifact: {
        closedAt: now(),
        resultRef: "autoMergeResult",
        cleanup: {
          worktree: {
            path: normalizePathForGit(worktreePath),
            removed: true,
          },
          branch: {
            name: branchName,
            deleted: true,
          },
        },
        finalStage: "closed",
      },
    },
    error: null,
  };
}
