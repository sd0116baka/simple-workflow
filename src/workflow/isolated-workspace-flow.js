function safePackageIdFromSourcePath(sourcePath) {
  return String(sourcePath ?? "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function allocateIsolatedWorkspace({
  taskContextPackage,
  baseBranch = "main",
  baseCommit = "stub-base-commit",
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (!taskContextPackage?.artifacts?.executionAuthorization?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少执行授权，不能分配隔离工作树。",
    };
  }

  const safePackageId = safePackageIdFromSourcePath(taskContextPackage.source?.path);

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "isolatedWorkspace",
      artifact: {
        worktreePath: `.workflow/worktrees/tasks/${safePackageId}`,
        branchName: `workflow/tasks/${safePackageId}`,
        baseBranch,
        baseCommit,
        status: "ready",
      },
    },
    error: null,
  };
}
