import { createStubAgentSession } from "./agent-runner.js";

function hasExecutionAuthorization(taskContextPackage) {
  return Boolean(taskContextPackage?.artifacts?.executionAuthorization?.body);
}

function hasMainAgentInitialization(taskContextPackage) {
  return taskContextPackage?.agentRuns?.[0]?.role === "main";
}

function hasIsolatedWorkspace(taskContextPackage) {
  return Boolean(taskContextPackage?.artifacts?.isolatedWorkspace?.body);
}

function nextExecutionRunId(taskContextPackage) {
  const existingReports = taskContextPackage?.artifacts?.executionReport ?? [];
  const nextIndex = Array.isArray(existingReports) ? existingReports.length + 1 : 1;
  return `execution-agent:${String(nextIndex).padStart(3, "0")}`;
}

function latestArtifact(taskContextPackage, artifactType) {
  const artifacts = taskContextPackage?.artifacts?.[artifactType];
  return Array.isArray(artifacts) && artifacts.length > 0
    ? artifacts[artifacts.length - 1]
    : null;
}

function inputArtifactRefsForExecution(taskContextPackage) {
  const baseRefs = [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
  ];
  const convergenceAdvice = latestArtifact(taskContextPackage, "convergenceAdvice");
  return convergenceAdvice
    ? [...baseRefs, convergenceAdvice.artifactId, "isolatedWorkspace"]
    : [...baseRefs, "isolatedWorkspace"];
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
  if (!hasIsolatedWorkspace(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能运行 execution agent。",
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
  const inputArtifactRefs = inputArtifactRefsForExecution(taskContextPackage);

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "executionReport",
      artifact: {
        summary: "stub execution completed",
        changedFiles: [],
        tests: [],
        notes: [
          inputArtifactRefs.some((ref) => ref.startsWith("convergenceAdvice:"))
            ? "execution agent stub 已接收上一轮收敛建议，仅验证循环追加结构。"
            : "execution agent stub 未修改文件，仅验证执行期追加结构。",
        ],
      },
      agentRun: {
        runId: nextExecutionRunId(taskContextPackage),
        role: "execution",
        sessionId: session.sessionId,
        inputArtifactRefs,
        outputArtifactRefs: [],
        status: session.status,
        startedAt,
        finishedAt,
      },
    },
    error: null,
  };
}
