import { gitSucceeds, runGit } from "./git-worktree-state.js";
import { findPackageResetTarget } from "./state-fixture-package-reset-target.js";
import { findLegacyAutoMergeResetTarget } from "./state-fixture-legacy-auto-merge-reset-target.js";

export async function resetMainToStubFixtureBase({ repositoryDir, storeDir }) {
  if (!gitSucceeds(["rev-parse", "--git-dir"], { cwd: repositoryDir })) return null;
  const baseCommit = await findPackageResetTarget({ repositoryDir, storeDir })
    ?? findLegacyAutoMergeResetTarget(repositoryDir);
  if (!baseCommit) return null;

  runGit(["checkout", "main"], { cwd: repositoryDir });
  runGit(["reset", "--hard", baseCommit], { cwd: repositoryDir });
  return baseCommit;
}
