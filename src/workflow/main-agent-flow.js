import { createStubAgentSession } from "./agent-runner.js";

function hasExecutionAuthorization(taskContextPackage) {
  return Boolean(taskContextPackage?.artifacts?.executionAuthorization?.body);
}

export function initializeMainAgent({
  taskContextPackage,
  runAgentSession = createStubAgentSession,
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (!hasExecutionAuthorization(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少执行授权，不能初始化 main agent。",
    };
  }

  const startedAt = now();
  const session = runAgentSession({
    role: "main",
    packageId: taskContextPackage.packageId,
    taskContextPackage,
  });
  const finishedAt = now();

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      agentRun: {
        runId: "agent-run-001",
        role: "main",
        sessionId: session.sessionId,
        inputArtifactRefs: [
          "taskDraft",
          "executionIntent",
          "executionAuthorization",
        ],
        outputArtifactRefs: [],
        status: session.status,
        startedAt,
        finishedAt,
      },
    },
    error: null,
  };
}
