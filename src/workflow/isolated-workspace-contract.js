import { normalizePathForGit } from "./git-path.js";

export function safePackageIdFromSourcePath(sourcePath) {
  return String(sourcePath ?? "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function worktreePathFromSafePackageId(safePackageId) {
  return `.workflow/worktrees/tasks/${safePackageId}`;
}

export function branchNameFromSafePackageId(safePackageId) {
  return `workflow/tasks/${safePackageId}`;
}

export function isolatedWorkspaceNamingFor(taskContextPackage) {
  const safePackageId = safePackageIdFromSourcePath(taskContextPackage?.source?.path);
  return {
    safePackageId,
    worktreePath: worktreePathFromSafePackageId(safePackageId),
    branchName: branchNameFromSafePackageId(safePackageId),
  };
}

export function buildIsolatedWorkspaceRequest({
  taskContextPackage,
  worktreePath,
  branchName,
  baseBranch,
  baseCommit,
  status = "ready",
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "isolatedWorkspace",
    artifact: {
      worktreePath: normalizePathForGit(worktreePath),
      branchName,
      baseBranch,
      baseCommit,
      status,
    },
  };
}
