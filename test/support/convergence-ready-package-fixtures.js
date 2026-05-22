import {
  createAgentRunFixture,
  createArtifactRecordFixture,
  createTaskContextPackageFixture,
} from "./task-context-package-fixtures.js";

export function createConvergenceReadyPackageFixture({
  packageId = "task-context-package:tasks/task-003.yaml",
  taskDraft = { id: "task-003" },
  executionReport = createArtifactRecordFixture("executionReport:001", {}, {
    appendedAt: "2026-05-18T10:00:01.000Z",
  }),
  reviewReport = createArtifactRecordFixture("reviewReport:001", {}, {
    appendedAt: "2026-05-18T10:00:02.000Z",
  }),
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
      executionReport: [executionReport],
      reviewReport: [reviewReport],
    },
    agentRuns,
    ...overrides,
  });
}
