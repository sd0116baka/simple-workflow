import { createStubAgentSession } from "./agent-runner.js";

function hasExecutionAuthorization(taskContextPackage) {
  return Boolean(taskContextPackage?.artifacts?.executionAuthorization?.body);
}

function hasMainAgentInitialization(taskContextPackage) {
  return taskContextPackage?.agentRuns?.[0]?.role === "main";
}

export function runExecutionAgent({
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
      error: "任务上下文包缺少执行授权，不能运行 execution agent。",
    };
  }
  if (!hasMainAgentInitialization(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 main agent 初始化记录，不能运行 execution agent。",
    };
  }

  const startedAt = now();
  const session = runAgentSession({
    role: "execution",
    packageId: taskContextPackage.packageId,
    taskContextPackage,
  });
  const finishedAt = now();

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "executionReport",
      artifact: {
        summary: "stub execution completed",
        changedFiles: [],
        tests: [],
        notes: [
          "execution agent stub 未修改文件，仅验证执行期追加结构。",
        ],
      },
      agentRun: {
        runId: "agent-run-002",
        role: "execution",
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
