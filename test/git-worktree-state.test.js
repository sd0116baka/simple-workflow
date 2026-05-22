import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  changedFilesInWorktree,
  diffChangedFiles,
  gitSucceeds,
  isAncestor,
  isPathInside,
  listedWorktreePaths,
  repositoryChangedFiles,
  resolveWorktreePath,
  runGit,
  stagedChangedFiles,
} from "../src/workflow/git-worktree-state.js";

function execGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createRepository(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-git-state-"));
  t.after(() => rm(repositoryDir, { recursive: true, force: true }));

  execGit(["init", "-b", "main"], repositoryDir);
  await writeFile(join(repositoryDir, "README.md"), "initial\n");
  execGit(["add", "README.md"], repositoryDir);
  execGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "initial commit",
  ], repositoryDir);

  return repositoryDir;
}

test("git worktree state helpers expose repository and worktree changes", async (t) => {
  const repositoryDir = await createRepository(t);
  const baseCommit = runGit(["rev-parse", "HEAD"], { cwd: repositoryDir });

  await writeFile(join(repositoryDir, "README.md"), "modified\n");
  await writeFile(join(repositoryDir, "untracked.txt"), "new\n");

  assert.deepEqual(changedFilesInWorktree(repositoryDir), ["README.md", "untracked.txt"]);
  assert.deepEqual(repositoryChangedFiles(repositoryDir), ["README.md", "untracked.txt"]);

  runGit(["add", "README.md"], { cwd: repositoryDir });
  assert.deepEqual(stagedChangedFiles(repositoryDir), ["README.md"]);

  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "modify readme",
  ], { cwd: repositoryDir });
  const headCommit = runGit(["rev-parse", "HEAD"], { cwd: repositoryDir });

  assert.deepEqual(diffChangedFiles(baseCommit, headCommit, repositoryDir), ["README.md"]);
  assert.equal(isAncestor(baseCommit, headCommit, repositoryDir), true);
  assert.equal(isAncestor(headCommit, baseCommit, repositoryDir), false);
});

test("resolveWorktreePath keeps absolute paths and resolves repository-relative paths", async (t) => {
  const repositoryDir = await createRepository(t);
  const absolutePath = join(repositoryDir, ".workflow", "worktrees", "task-001");

  assert.equal(resolveWorktreePath(absolutePath, repositoryDir), absolutePath);
  assert.equal(isAbsolute(resolveWorktreePath(".workflow/worktrees/task-001", repositoryDir)), true);
  assert.equal(resolveWorktreePath(null, repositoryDir), null);
});

test("git worktree adapter exposes success checks, path guards, and listed worktrees", async (t) => {
  const repositoryDir = await createRepository(t);

  assert.equal(gitSucceeds(["rev-parse", "--verify", "HEAD"], { cwd: repositoryDir }), true);
  assert.equal(gitSucceeds(["rev-parse", "--verify", "missing-ref"], { cwd: repositoryDir }), false);
  assert.equal(isPathInside(repositoryDir, join(repositoryDir, ".workflow", "worktrees")), true);
  assert.equal(isPathInside(join(repositoryDir, ".workflow"), repositoryDir), false);
  assert.deepEqual(listedWorktreePaths(repositoryDir), [resolve(repositoryDir)]);
});
