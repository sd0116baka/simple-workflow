function toChangedFiles(repositoryStatus) {
  return (repositoryStatus?.entries ?? []).map((entry) => entry.path);
}

export function normalizeRuntimeSnapshot(runtimeSnapshot = {}) {
  return {
    activeWork: runtimeSnapshot.activeWork ?? null,
    worktree: {
      clean: runtimeSnapshot.worktree?.clean ?? true,
      changedFiles: [...(runtimeSnapshot.worktree?.changedFiles ?? [])],
    },
  };
}

export function runtimeSnapshotFromRepositoryStatus(repositoryStatus = { clean: true, entries: [] }) {
  return {
    activeWork: null,
    worktree: {
      clean: repositoryStatus.clean ?? true,
      changedFiles: toChangedFiles(repositoryStatus),
    },
  };
}
