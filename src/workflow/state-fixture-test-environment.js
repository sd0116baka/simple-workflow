import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { gitSucceeds, runGit } from "./git-worktree-state.js";
import { resetMainToStubFixtureBase } from "./state-fixture-base-reset.js";
import { cleanupStateFixtureStorage } from "./state-fixture-storage-cleanup.js";
import { removeExistingStubWorktrees } from "./state-fixture-worktree-cleanup.js";

export const TEST_ENV_GITIGNORE = [
  ".workflow/",
  "tasks/stub-*.yaml",
  "",
].join("\n");

export function assertTestEnvironment(repositoryDir) {
  const normalized = normalize(resolve(repositoryDir)).replace(/\\/g, "/");
  if (!normalized.includes("/.workflow/test-environment/repository")) {
    throw new Error("测试状态种子只能写入 .workflow/test-environment/repository。");
  }
}

export async function removeStaleGitIndexLock(repositoryDir) {
  try {
    await unlink(join(repositoryDir, ".git", "index.lock"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export async function ensureTestEnvironmentGitignore(repositoryDir) {
  if (!gitSucceeds(["rev-parse", "--git-dir"], { cwd: repositoryDir })) return;

  await removeStaleGitIndexLock(repositoryDir);
  await writeFile(join(repositoryDir, ".gitignore"), TEST_ENV_GITIGNORE, "utf8");
  runGit(["add", ".gitignore"], { cwd: repositoryDir });
  if (gitSucceeds(["diff", "--cached", "--quiet", "--", ".gitignore"], { cwd: repositoryDir })) {
    return;
  }

  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "ignore generated test fixtures",
  ], { cwd: repositoryDir });
}

export async function resetManagedStateFixtureEnvironment({
  repositoryDir,
  tasksDir,
  storeDir,
} = {}) {
  if (!repositoryDir || !tasksDir || !storeDir) {
    throw new Error("repositoryDir, tasksDir and storeDir are required");
  }
  assertTestEnvironment(repositoryDir);
  await mkdir(tasksDir, { recursive: true });
  const resetCommit = await resetMainToStubFixtureBase({ repositoryDir, storeDir });
  const removedWorktrees = removeExistingStubWorktrees(repositoryDir);
  const { removedTaskFiles, removedPackages } = await cleanupStateFixtureStorage({
    tasksDir,
    storeDir,
  });
  await ensureTestEnvironmentGitignore(repositoryDir);

  return {
    removedTaskFiles,
    removedPackages,
    removedWorktrees,
    resetCommit,
  };
}
