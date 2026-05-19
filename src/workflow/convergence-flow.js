import { createStubAgentSession } from "./agent-runner.js";

function latestArtifact(taskContextPackage, artifactType) {
  const artifacts = taskContextPackage?.artifacts?.[artifactType];
  return Array.isArray(artifacts) && artifacts.length > 0
    ? artifacts[artifacts.length - 1]
    : null;
}

function mainAgentSessionId(taskContextPackage) {
  const mainInitialization = taskContextPackage?.agentRuns?.[0];
  return mainInitialization?.role === "main" ? mainInitialization.sessionId : null;
}

function nextConvergenceRunId(taskContextPackage) {
  const existingAdvice = taskContextPackage?.artifacts?.convergenceAdvice ?? [];
  const nextIndex = Array.isArray(existingAdvice) ? existingAdvice.length + 1 : 1;
  return `main-agent:convergence:${String(nextIndex).padStart(3, "0")}`;
}

function inputArtifactRefsForConvergence(executionReport, reviewReport) {
  return [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    executionReport.artifactId,
    reviewReport.artifactId,
  ];
}

export function runConvergence({
  taskContextPackage,
  runAgentSession = createStubAgentSession,
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const sessionId = mainAgentSessionId(taskContextPackage);
  if (!sessionId) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 main agent 初始化记录，不能运行收敛环节。",
    };
  }

  const executionReport = latestArtifact(taskContextPackage, "executionReport");
  if (!executionReport) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 executionReport，不能运行收敛环节。",
    };
  }

  const reviewReport = latestArtifact(taskContextPackage, "reviewReport");
  if (!reviewReport) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 reviewReport，不能运行收敛环节。",
    };
  }

  const startedAt = now();
  const session = runAgentSession({
    role: "main",
    packageId: taskContextPackage.packageId,
    sessionId,
    taskContextPackage,
  });
  const finishedAt = now();

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "convergenceAdvice",
      artifact: {
        summary: "stub convergence advice",
        nextAction: "等待真实 main agent 根据执行和审查结果给出下一轮执行意见。",
        basis: [
          executionReport.artifactId,
          reviewReport.artifactId,
        ],
      },
      agentRun: {
        runId: nextConvergenceRunId(taskContextPackage),
        role: "main",
        sessionId: session.sessionId,
        inputArtifactRefs: inputArtifactRefsForConvergence(executionReport, reviewReport),
        outputArtifactRefs: [],
        status: session.status,
        startedAt,
        finishedAt,
      },
    },
    error: null,
  };
}
