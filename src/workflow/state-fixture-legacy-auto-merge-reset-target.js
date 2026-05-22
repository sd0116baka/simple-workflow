import { gitSucceeds, runGit } from "./git-worktree-state.js";
import { isExistingCommit } from "./state-fixture-git-commit-selection.js";

function isStubAutoMergeSubject(subject) {
  return /^chore\(auto-merge\): stub-/.test(subject ?? "");
}

export function findLegacyAutoMergeResetTarget(repositoryDir) {
  if (!gitSucceeds(["rev-parse", "--git-dir"], { cwd: repositoryDir })) return null;
  const output = runGit(["log", "--first-parent", "--format=%H%x00%s", "-50"], {
    cwd: repositoryDir,
  });
  let foundStubCommit = false;
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue;
    const [commit, subject] = line.split("\0");
    if (isStubAutoMergeSubject(subject)) {
      foundStubCommit = true;
      continue;
    }
    return foundStubCommit && isExistingCommit({ repositoryDir, commit }) ? commit : null;
  }
  return null;
}
