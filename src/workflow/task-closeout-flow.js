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

function changedFilesInWorktree(cwd) {
  const trackedOutput = runGit(["diff", "--name-only", "HEAD", "--"], { cwd });
  const untrackedOutput = runGit(["ls-files", "--others", "--exclude-standard"], { cwd });
  return Array.from(new Set([
    ...trackedOutput.split(/\r?\n/).filter(Boolean),
    ...untrackedOutput.split(/\r?\n/).filter(Boolean),
  ]));
}

function diffChangedFiles(baseCommit, headCommit, cwd) {
  const output = runGit(["diff", "--name-only", `${baseCommit}...${headCommit}`, "--"], { cwd });
  return output
    .split(/\r?\n/)
    .filter(Boolean);
}

function isAncestor(ancestorCommit, descendantCommit, cwd) {
  try {
    runGit(["merge-base", "--is-ancestor", ancestorCommit, descendantCommit], { cwd });
    return true;
  } catch {
    return false;
  }
}

function removeWorkspaceAndBranch({ repositoryDir, worktreePath, branchName }) {
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

export function closeTaskWithoutMerge({
  taskContextPackage,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const humanDecision = taskContextPackage.artifacts?.humanDecision;
  if (humanDecision?.body?.decision !== "accept-completion") {
    return {
      appendRequest: null,
      error: "任务尚未由人工接受完成，不能无合并收尾。",
    };
  }

  const autoMergeRejection = taskContextPackage.artifacts?.autoMergeRejection;
  const hasNoChangesRejection = autoMergeRejection?.body?.reasons?.some((item) =>
    item.code === "NO_CHANGES");
  if (!hasNoChangesRejection) {
    return {
      appendRequest: null,
      error: "任务没有 NO_CHANGES 自动合并拒绝记录，不能无合并收尾。",
    };
  }

  const isolatedWorkspace = taskContextPackage.artifacts?.isolatedWorkspace;
  if (!isolatedWorkspace?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能收尾。",
    };
  }

  const worktreePath = isolatedWorkspace.body.worktreePath;
  const branchName = isolatedWorkspace.body.branchName;
  const absoluteWorktreePath = resolveWorktreePath(worktreePath, repositoryDir);
  const acceptedBase = humanDecision.body.acceptedWork?.baseCommit ?? isolatedWorkspace.body.baseCommit;
  if (!acceptedBase) {
    return {
      appendRequest: null,
      error: "任务缺少 accepted base commit，不能无合并收尾。",
    };
  }

  try {
    if (absoluteWorktreePath && existsSync(absoluteWorktreePath)) {
      const worktreeChangedFiles = changedFilesInWorktree(absoluteWorktreePath);
      const worktreeHead = runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath });
      if (!isAncestor(acceptedBase, worktreeHead, absoluteWorktreePath)) {
        return {
          appendRequest: null,
          error: "隔离工作树 HEAD 不包含人工接受时的 baseCommit，不能无合并收尾。",
        };
      }
      const committedChangedFiles = diffChangedFiles(acceptedBase, worktreeHead, absoluteWorktreePath);
      if (worktreeChangedFiles.length > 0 || committedChangedFiles.length > 0) {
        return {
          appendRequest: null,
          error: "隔离工作树已经出现变更，不能无合并收尾。",
        };
      }
    }

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
        resultRef: "autoMergeRejection",
        closeoutReason: "no-merge-needed",
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
