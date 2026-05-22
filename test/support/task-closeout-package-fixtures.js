import {
  createArtifactRecordFixture,
  createTaskContextPackageFixture,
} from "./task-context-package-fixtures.js";

function createTaskCloseoutIsolatedWorkspaceFixture({
  worktreePath = ".workflow/worktrees/tasks/tasks-task-003",
  branchName = "workflow/tasks/tasks-task-003",
  baseBranch = "main",
  baseCommit,
} = {}) {
  return createArtifactRecordFixture(
    "isolatedWorkspace",
    {
      worktreePath,
      branchName,
      baseBranch,
      baseCommit,
      status: "ready",
    },
    {
      appendedAt: "2026-05-19T10:00:04.000Z",
    },
  );
}

export function createMergedCloseoutPackageFixture({
  packageId = "task-context-package:tasks/task-003.yaml",
  currentWorkStage = "merged",
  baseCommit,
  sourceCommit,
  worktreePath = ".workflow/worktrees/tasks/tasks-task-003",
  branchName = "workflow/tasks/tasks-task-003",
  isolatedWorkspace = createTaskCloseoutIsolatedWorkspaceFixture({
    worktreePath,
    branchName,
    baseCommit,
  }),
  autoMergeResult = createArtifactRecordFixture(
    "autoMergeResult",
    {
      mergedAt: "2026-05-19T10:05:00.000Z",
      planRef: "autoMergePlan",
      source: {
        worktreePath,
        branchName,
        baseCommit,
        commit: sourceCommit,
      },
      target: {
        branchName: "main",
        beforeCommit: baseCommit,
        afterCommit: sourceCommit,
      },
      changeSet: {
        changedFiles: ["result.txt"],
      },
    },
    {
      appendedAt: "2026-05-19T10:05:00.000Z",
    },
  ),
  overrides = {},
} = {}) {
  return createTaskContextPackageFixture({
    packageId,
    currentWorkStage,
    artifacts: {
      isolatedWorkspace,
      autoMergeResult,
    },
    ...overrides,
  });
}

export function createCancelledCloseoutPackageFixture({
  packageId = "task-context-package:tasks/task-003.yaml",
  currentWorkStage = "task-closeout",
  baseCommit,
  worktreePath = ".workflow/worktrees/tasks/tasks-task-003",
  branchName = "workflow/tasks/tasks-task-003",
  isolatedWorkspace = createTaskCloseoutIsolatedWorkspaceFixture({
    worktreePath,
    branchName,
    baseCommit,
  }),
  humanDecision = createArtifactRecordFixture(
    "humanDecision",
    {
      decision: "cancel-task",
      decidedAt: "2026-05-19T10:09:00.000Z",
      targetType: "convergenceFailure",
      targetRef: "convergenceFailure:001",
      nextRequiredStage: "task-closeout",
    },
    {
      appendedAt: "2026-05-19T10:09:00.000Z",
    },
  ),
  overrides = {},
} = {}) {
  return createTaskContextPackageFixture({
    packageId,
    currentWorkStage,
    artifacts: {
      isolatedWorkspace,
      humanDecision,
    },
    ...overrides,
  });
}
