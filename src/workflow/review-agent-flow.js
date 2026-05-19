import { createStubAgentSession } from "./agent-runner.js";

function latestExecutionReport(taskContextPackage) {
  const reports = taskContextPackage?.artifacts?.executionReport;
  return Array.isArray(reports) && reports.length > 0
    ? reports[reports.length - 1]
    : null;
}

function latestConvergenceAdvice(taskContextPackage) {
  const advice = taskContextPackage?.artifacts?.convergenceAdvice;
  return Array.isArray(advice) && advice.length > 0
    ? advice[advice.length - 1]
    : null;
}

function nextReviewRunId(taskContextPackage) {
  const existingReports = taskContextPackage?.artifacts?.reviewReport ?? [];
  const nextIndex = Array.isArray(existingReports) ? existingReports.length + 1 : 1;
  return `review-agent:${String(nextIndex).padStart(3, "0")}`;
}

function inputArtifactRefsForReview(taskContextPackage, executionReport) {
  const refs = [
    "taskDraft",
    "executionAuthorization",
    executionReport.artifactId,
  ];
  const convergenceAdvice = latestConvergenceAdvice(taskContextPackage);
  return convergenceAdvice
    ? [
        "taskDraft",
        "executionAuthorization",
        convergenceAdvice.artifactId,
        executionReport.artifactId,
      ]
    : refs;
}

export function runReviewAgent({
  taskContextPackage,
  runAgentSession = createStubAgentSession,
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const executionReport = latestExecutionReport(taskContextPackage);
  if (!executionReport) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 executionReport，不能运行 review agent。",
    };
  }

  const startedAt = now();
  const session = runAgentSession({
    role: "review",
    packageId: taskContextPackage.packageId,
    taskContextPackage,
  });
  const finishedAt = now();

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "reviewReport",
      artifact: {
        outcome: "passed",
        summary: "stub review passed",
        findings: [],
      },
      agentRun: {
        runId: nextReviewRunId(taskContextPackage),
        role: "review",
        sessionId: session.sessionId,
        inputArtifactRefs: inputArtifactRefsForReview(taskContextPackage, executionReport),
        outputArtifactRefs: [],
        status: session.status,
        startedAt,
        finishedAt,
      },
    },
    error: null,
  };
}
