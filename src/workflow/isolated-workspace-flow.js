import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { normalizePathForGit } from "./git-path.js";
import {
  gitSucceeds,
  isPathInside,
  listedWorktreePaths,
  resolveWorktreePath,
  runGit,
} from "./git-worktree-state.js";
import {
  buildIsolatedWorkspaceRequest,
  isolatedWorkspaceNamingFor,
} from "./isolated-workspace-contract.js";
import { hasArtifactBody } from "./task-package-artifacts.js";

function findRegisteredWorktree({ repositoryDir, absoluteWorktreePath }) {
  const normalizedTarget = resolve(absoluteWorktreePath).toLowerCase();

  return listedWorktreePaths(repositoryDir)
    .some((registeredPath) => resolve(registeredPath).toLowerCase() === normalizedTarget);
}

function resetAndCleanGitWorktree({ absoluteWorktreePath, baseBranch }) {
  runGit(["reset", "--hard", baseBranch], { cwd: absoluteWorktreePath });
  runGit(["clean", "-fdx"], { cwd: absoluteWorktreePath });
  return runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath });
}

function managedWorktreeRoot(repositoryDir) {
  return resolve(repositoryDir, ".workflow", "worktrees", "tasks");
}

function removeResidualWorktreePath({ repositoryDir, absoluteWorktreePath, worktreePath }) {
  if (!isPathInside(managedWorktreeRoot(repositoryDir), absoluteWorktreePath)) {
    throw new Error(`拒绝清理非系统管理的隔离工作树路径：${worktreePath}`);
  }
  rmSync(absoluteWorktreePath, { recursive: true, force: true });
}

function ensureGitWorktree({
  repositoryDir,
  worktreePath,
  branchName,
  baseBranch,
}) {
  const absoluteWorktreePath = resolveWorktreePath(worktreePath, repositoryDir);
  const baseCommit = runGit(["rev-parse", baseBranch], { cwd: repositoryDir });
  const worktreeIsRegistered = findRegisteredWorktree({
    repositoryDir,
    absoluteWorktreePath,
  });

  if (worktreeIsRegistered) {
    if (existsSync(absoluteWorktreePath)) {
      return {
        baseCommit: resetAndCleanGitWorktree({
          absoluteWorktreePath,
          baseBranch,
        }),
      };
    }

    runGit(["worktree", "prune"], { cwd: repositoryDir });
  }

  if (existsSync(absoluteWorktreePath)) {
    removeResidualWorktreePath({
      repositoryDir,
      absoluteWorktreePath,
      worktreePath,
    });
  }

  mkdirSync(dirname(absoluteWorktreePath), { recursive: true });
  const branchExists = gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
    cwd: repositoryDir,
  });
  const addArgs = branchExists
    ? ["worktree", "add", normalizePathForGit(absoluteWorktreePath), branchName]
    : ["worktree", "add", "-b", branchName, normalizePathForGit(absoluteWorktreePath), baseBranch];
  runGit(addArgs, { cwd: repositoryDir });

  return { baseCommit };
}

export function allocateIsolatedWorkspace({
  taskContextPackage,
  baseBranch = "main",
  repositoryDir = process.cwd(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (!hasArtifactBody(taskContextPackage, "executionAuthorization")) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少执行授权，不能分配隔离工作树。",
    };
  }

  const { worktreePath, branchName } = isolatedWorkspaceNamingFor(taskContextPackage);
  let baseCommit;

  try {
    ({ baseCommit } = ensureGitWorktree({
      repositoryDir,
      worktreePath,
      branchName,
      baseBranch,
    }));
  } catch (error) {
    return {
      appendRequest: null,
      error: error.message,
    };
  }

  return {
    appendRequest: buildIsolatedWorkspaceRequest({
      taskContextPackage,
      worktreePath: relative(repositoryDir, resolve(repositoryDir, worktreePath)),
      branchName,
      baseBranch,
      baseCommit,
    }),
    error: null,
  };
}
