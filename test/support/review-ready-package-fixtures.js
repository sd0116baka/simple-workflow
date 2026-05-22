import {
  createAgentRunFixture,
  createArtifactRecordFixture,
  createTaskContextPackageFixture,
} from "./task-context-package-fixtures.js";

export function createReviewReadyPackageFixture({
  packageId = "task-context-package:tasks/task-003.yaml",
  taskDraft = { id: "task-003" },
  worktreePath = ".workflow/worktrees/tasks/tasks-task-003",
  executionReport = createArtifactRecordFixture(
    "executionReport:001",
    {
      summary: "stub execution completed",
    },
    {
      appendedAt: "2026-05-18T10:00:01.000Z",
    },
  ),
  agentRuns = [
    createAgentRunFixture(),
    createAgentRunFixture({
      runId: "execution-agent:001",
      role: "execution",
      sessionId: "session:execution",
      outputArtifactRefs: ["executionReport:001"],
      startedAt: "2026-05-18T10:00:01.000Z",
      finishedAt: "2026-05-18T10:00:01.000Z",
    }),
  ],
  overrides = {},
} = {}) {
  return createTaskContextPackageFixture({
    packageId,
    taskDraft,
    artifacts: {
      executionAuthorization: createArtifactRecordFixture("executionAuthorization", {}, {
        appendedAt: "2026-05-18T09:01:00.000Z",
      }),
      isolatedWorkspace: createArtifactRecordFixture(
        "isolatedWorkspace",
        {
          worktreePath,
        },
        {
          appendedAt: "2026-05-18T09:02:00.000Z",
        },
      ),
      executionReport: [executionReport],
    },
    agentRuns,
    ...overrides,
  });
}
