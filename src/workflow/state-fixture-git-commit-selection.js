import { gitSucceeds } from "./git-worktree-state.js";

export function isExistingCommit({ repositoryDir, commit }) {
  if (!commit || !/^[a-f0-9]{7,40}$/i.test(commit)) return false;
  return gitSucceeds(["cat-file", "-e", `${commit}^{commit}`], { cwd: repositoryDir });
}

export function selectEarliestExistingCommit({ repositoryDir, commits }) {
  let selected = null;
  for (const commit of commits) {
    if (!isExistingCommit({ repositoryDir, commit })) continue;
    if (!selected || gitSucceeds(["merge-base", "--is-ancestor", commit, selected], {
      cwd: repositoryDir,
    })) {
      selected = commit;
    }
  }
  return selected;
}
