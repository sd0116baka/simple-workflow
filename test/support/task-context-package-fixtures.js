export function createTaskContextPackageFixture(overrides = {}) {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "execution-agent",
    source: { path: "tasks/task-001.yaml" },
    taskDraft: { id: "task-001", name: "测试任务" },
    artifacts: {},
    timeline: [],
    ...overrides,
  };
}

export function createArtifactRecordFixture(artifactId, body = {}, overrides = {}) {
  return { artifactId, body, ...overrides };
}

export function createAgentRunFixture(overrides = {}) {
  return {
    runId: "main-agent:initialization",
    role: "main",
    sessionId: "session:main",
    inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization"],
    outputArtifactRefs: [],
    status: "succeeded",
    startedAt: "2026-05-18T10:00:00.000Z",
    finishedAt: "2026-05-18T10:00:00.000Z",
    ...overrides,
  };
}
