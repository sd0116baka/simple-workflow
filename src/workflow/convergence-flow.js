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

function inputArtifactRefsForConvergence(taskContextPackage, executionReport, reviewReport) {
  const failure = latestArtifact(taskContextPackage, "convergenceFailure");
  const guidance = latestArtifact(taskContextPackage, "humanConvergenceGuidance");
  const refs = [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    executionReport.artifactId,
    reviewReport.artifactId,
  ];
  const convergenceAdvice = latestArtifact(taskContextPackage, "convergenceAdvice");
  const inputRefs = convergenceAdvice
    ? [
        "taskDraft",
        "executionIntent",
        "executionAuthorization",
        convergenceAdvice.artifactId,
        executionReport.artifactId,
        reviewReport.artifactId,
      ]
    : refs;
  const humanCorrectionRefs = [
    failure?.artifactId,
    guidance?.artifactId,
  ].filter(Boolean);
  return humanCorrectionRefs.length > 0
    ? [
        ...inputRefs.slice(0, -2),
        ...humanCorrectionRefs,
        ...inputRefs.slice(-2),
      ]
    : inputRefs;
}

function shouldCompleteTask(taskContextPackage, reviewReport) {
  return Boolean(
    reviewReport?.body?.outcome === "passed"
      && latestArtifact(taskContextPackage, "convergenceAdvice"),
  );
}

function convergenceFailureArtifact(taskContextPackage, executionReport, reviewReport, maxIterations) {
  const convergenceAdvice = taskContextPackage?.artifacts?.convergenceAdvice ?? [];
  const adviceCount = Array.isArray(convergenceAdvice) ? convergenceAdvice.length : 0;
  return {
    artifactType: "convergenceFailure",
    artifact: {
      summary: "当前轮次无法自动收敛。",
      reasonCode: "max-iterations-reached",
      basisRefs: [
        executionReport.artifactId,
        reviewReport.artifactId,
      ],
      attemptedFixes: convergenceAdvice.map((advice) => advice.artifactId),
      unresolvedIssues: reviewReport.body?.findings ?? [],
      humanDecisionQuestion: "请提供人工收敛意见继续下一轮，或取消任务并恢复执行前状态。",
      maxIterations,
      completedIterations: Math.max(adviceCount, 1),
    },
  };
}

function shouldFailConvergence(taskContextPackage, reviewReport, maxIterations) {
  if (shouldCompleteTask(taskContextPackage, reviewReport)) return false;
  if (!Number.isInteger(maxIterations)) return false;
  const convergenceAdvice = taskContextPackage?.artifacts?.convergenceAdvice ?? [];
  const adviceCount = Array.isArray(convergenceAdvice) ? convergenceAdvice.length : 0;
  return adviceCount >= maxIterations;
}

function convergenceArtifact(taskContextPackage, executionReport, reviewReport, maxIterations) {
  if (shouldCompleteTask(taskContextPackage, reviewReport)) {
    return {
      artifactType: "convergenceSuccess",
      artifact: {
        summary: "stub task completed",
        basis: [
          executionReport.artifactId,
          reviewReport.artifactId,
        ],
      },
    };
  }

  if (shouldFailConvergence(taskContextPackage, reviewReport, maxIterations)) {
    return convergenceFailureArtifact(taskContextPackage, executionReport, reviewReport, maxIterations);
  }

  return {
    artifactType: "convergenceAdvice",
    artifact: {
      summary: "stub convergence advice",
      nextAction: "等待真实 main agent 根据执行和审查结果给出下一轮执行意见。",
      basis: [
        executionReport.artifactId,
        reviewReport.artifactId,
      ],
    },
  };
}

export function runConvergence({
  taskContextPackage,
  runAgentSession = createStubAgentSession,
  maxIterations = null,
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
  const { artifactType, artifact } = convergenceArtifact(
    taskContextPackage,
    executionReport,
    reviewReport,
    maxIterations,
  );

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType,
      artifact,
      agentRun: {
        runId: nextConvergenceRunId(taskContextPackage),
        role: "main",
        sessionId: session.sessionId,
        inputArtifactRefs: inputArtifactRefsForConvergence(
          taskContextPackage,
          executionReport,
          reviewReport,
        ),
        outputArtifactRefs: [],
        status: session.status,
        startedAt,
        finishedAt,
      },
    },
    error: null,
  };
}
