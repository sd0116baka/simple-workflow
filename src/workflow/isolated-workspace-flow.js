import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

function safePackageIdFromSourcePath(sourcePath) {
  return String(sourcePath ?? "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

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

function worktreePathFromSafePackageId(safePackageId) {
  return `.workflow/worktrees/tasks/${safePackageId}`;
}

function findRegisteredWorktree({ repositoryDir, absoluteWorktreePath }) {
  const output = runGit(["worktree", "list", "--porcelain"], { cwd: repositoryDir });
  const normalizedTarget = resolve(absoluteWorktreePath).toLowerCase();

  return output
    .split(/\n(?=worktree )/)
    .filter(Boolean)
    .some((entry) => {
      const firstLine = entry.split(/\r?\n/, 1)[0] ?? "";
      const registeredPath = firstLine.replace(/^worktree /, "");
      return resolve(registeredPath).toLowerCase() === normalizedTarget;
    });
}

function ensureGitWorktree({
  repositoryDir,
  worktreePath,
  branchName,
  baseBranch,
}) {
  const absoluteWorktreePath = isAbsolute(worktreePath)
    ? worktreePath
    : resolve(repositoryDir, worktreePath);
  const baseCommit = runGit(["rev-parse", baseBranch], { cwd: repositoryDir });
  const worktreeIsRegistered = findRegisteredWorktree({
    repositoryDir,
    absoluteWorktreePath,
  });

  if (worktreeIsRegistered) {
    if (!existsSync(absoluteWorktreePath)) {
      throw new Error(`隔离工作树已注册但路径不存在：${worktreePath}`);
    }
    return {
      baseCommit: runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath }),
    };
  }

  if (existsSync(absoluteWorktreePath)) {
    throw new Error(`隔离工作树路径已存在但未注册为 git worktree：${worktreePath}`);
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
  if (!taskContextPackage?.artifacts?.executionAuthorization?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少执行授权，不能分配隔离工作树。",
    };
  }

  const safePackageId = safePackageIdFromSourcePath(taskContextPackage.source?.path);
  const worktreePath = worktreePathFromSafePackageId(safePackageId);
  const branchName = `workflow/tasks/${safePackageId}`;
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
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "isolatedWorkspace",
      artifact: {
        worktreePath: normalizePathForGit(relative(repositoryDir, resolve(repositoryDir, worktreePath))),
        branchName,
        baseBranch,
        baseCommit,
        status: "ready",
      },
    },
    error: null,
  };
}
