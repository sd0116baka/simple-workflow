import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runGit } from "./git-worktree-state.js";
import { removeWorkspaceAndBranch } from "./task-closeout-cleanup-transaction.js";
import {
  fixtureBranchName,
  fixtureWorktreePath,
} from "./state-fixture-paths.js";

export async function createFixtureWorktree({ repositoryDir, id }) {
  const branchName = fixtureBranchName(id);
  const worktreePath = fixtureWorktreePath(id);
  const baseCommit = runGit(["rev-parse", "main"], { cwd: repositoryDir });
  removeWorkspaceAndBranch({ repositoryDir, worktreePath, branchName });
  runGit([
    "worktree",
    "add",
    "-b",
    branchName,
    worktreePath,
    baseCommit,
  ], { cwd: repositoryDir });
  const absoluteWorktreePath = resolve(repositoryDir, worktreePath);
  await mkdir(join(absoluteWorktreePath, "fixtures"), { recursive: true });
  await writeFile(
    join(absoluteWorktreePath, "fixtures", `${id}.txt`),
    `fixture worktree for ${id}\n`,
    "utf8",
  );
  return {
    baseCommit,
    branchName,
    worktreePath,
  };
}
