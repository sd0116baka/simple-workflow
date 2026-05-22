import { writeFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { gitSucceeds, runGit } from "./git-worktree-state.js";

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

export async function ensureTestEnvironmentGitignore(repositoryDir) {
  if (!gitSucceeds(["rev-parse", "--git-dir"], { cwd: repositoryDir })) return;

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
