import { execFileSync } from "node:child_process";
import { isAbsolute, resolve } from "node:path";

export function runGit(args, { cwd }) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

export function gitSucceeds(args, { cwd }) {
  try {
    runGit(args, { cwd });
    return true;
  } catch {
    return false;
  }
}

export function resolveWorktreePath(worktreePath, repositoryDir) {
  if (!worktreePath) return null;
  return isAbsolute(worktreePath) ? worktreePath : resolve(repositoryDir, worktreePath);
}

export function isPathInside(parentPath, childPath) {
  const parent = resolve(parentPath).toLowerCase();
  const child = resolve(childPath).toLowerCase();
  return child === parent || child.startsWith(`${parent}\\`) || child.startsWith(`${parent}/`);
}

export function listedWorktreePaths(repositoryDir) {
  const output = runGit(["worktree", "list", "--porcelain"], { cwd: repositoryDir });
  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => resolve(line.slice("worktree ".length)));
}

function nonEmptyLines(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean);
}

export function changedFilesInWorktree(cwd) {
  const trackedOutput = runGit(["diff", "--name-only", "HEAD", "--"], { cwd });
  const untrackedOutput = runGit(["ls-files", "--others", "--exclude-standard"], { cwd });
  return Array.from(new Set([
    ...nonEmptyLines(trackedOutput),
    ...nonEmptyLines(untrackedOutput),
  ]));
}

export function repositoryChangedFiles(cwd) {
  const output = runGit(["status", "--porcelain", "--untracked-files=all"], { cwd });
  return nonEmptyLines(output)
    .map((line) => line.slice(3));
}

export function stagedChangedFiles(cwd) {
  const output = runGit(["diff", "--cached", "--name-only", "--"], { cwd });
  return nonEmptyLines(output);
}

export function diffChangedFiles(baseCommit, headCommit, cwd) {
  const output = runGit(["diff", "--name-only", `${baseCommit}...${headCommit}`, "--"], { cwd });
  return nonEmptyLines(output);
}

export function isAncestor(ancestorCommit, descendantCommit, cwd) {
  return gitSucceeds(["merge-base", "--is-ancestor", ancestorCommit, descendantCommit], { cwd });
}
