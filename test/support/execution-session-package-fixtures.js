import {
  createAgentRunFixture,
  createArtifactRecordFixture,
  createTaskContextPackageFixture,
} from "./task-context-package-fixtures.js";

export function createExecutionSessionPackageFixture({
  packageId = "task-context-package:tasks/task-003.yaml",
  taskDraft = { id: "task-003" },
  worktreePath = ".workflow/worktrees/tasks/tasks-task-003",
  agentRuns = [createAgentRunFixture()],
  overrides = {},
} = {}) {
  return createTaskContextPackageFixture({
    packageId,
    taskDraft,
    artifacts: {
      executionIntent: createArtifactRecordFixture("executionIntent", {}, {
        appendedAt: "2026-05-18T09:00:00.000Z",
      }),
      executionAuthorization: createArtifactRecordFixture("executionAuthorization", {}, {
        appendedAt: "2026-05-18T09:01:00.000Z",
      }),
      isolatedWorkspace: createArtifactRecordFixture(
        "isolatedWorkspace",
        {
          worktreePath,
          baseCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        {
          appendedAt: "2026-05-18T09:02:00.000Z",
        },
      ),
    },
    agentRuns,
    ...overrides,
  });
}
