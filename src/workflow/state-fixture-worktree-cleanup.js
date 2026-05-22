import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { gitSucceeds } from "./git-worktree-state.js";
import { removeWorkspaceAndBranch } from "./task-closeout-cleanup-transaction.js";
import { STAGE_FIXTURES } from "./state-fixture-catalog.js";
import {
  fixtureBranchName,
  fixtureWorktreePath,
} from "./state-fixture-paths.js";

export function removeExistingStubWorktrees(repositoryDir) {
  if (!gitSucceeds(["rev-parse", "--git-dir"], { cwd: repositoryDir })) return 0;
  let removed = 0;
  for (const fixture of STAGE_FIXTURES) {
    const absoluteWorktreePath = resolve(repositoryDir, fixtureWorktreePath(fixture.id));
    const branchName = fixtureBranchName(fixture.id);
    const existed = existsSync(absoluteWorktreePath)
      || gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
        cwd: repositoryDir,
      });
    const result = removeWorkspaceAndBranch({
      repositoryDir,
      worktreePath: fixtureWorktreePath(fixture.id),
      branchName,
    });
    if (existed && !result.error) removed += 1;
  }
  return removed;
}
