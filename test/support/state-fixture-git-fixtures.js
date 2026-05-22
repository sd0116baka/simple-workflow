import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function runFixtureGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function fixtureGitSucceeds(args, cwd) {
  try {
    runFixtureGit(args, cwd);
    return true;
  } catch {
    return false;
  }
}

export async function createManagedTestRepository(t, prefix = "simple-workflow-fixture-git-") {
  const rootDir = await mkdtemp(join(tmpdir(), prefix));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const repositoryDir = join(rootDir, ".workflow", "test-environment", "repository");
  await mkdir(repositoryDir, { recursive: true });
  await writeFile(join(repositoryDir, "README.md"), "fixture repository\n", "utf8");
  runFixtureGit(["init", "-b", "main"], repositoryDir);
  runFixtureGit(["add", "README.md"], repositoryDir);
  runFixtureGit([
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
