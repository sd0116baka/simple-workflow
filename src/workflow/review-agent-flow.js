import { createStubAgentSession } from "./agent-runner.js";
import { latestArtifactRecord } from "./task-package-artifacts.js";

function latestExecutionReport(taskContextPackage) {
  return latestArtifactRecord(taskContextPackage, "executionReport");
}

function latestConvergenceAdvice(taskContextPackage) {
  return latestArtifactRecord(taskContextPackage, "convergenceAdvice");
}

function hasIsolatedWorkspace(taskContextPackage) {
  return Boolean(taskContextPackage?.artifacts?.isolatedWorkspace?.body);
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
    "isolatedWorkspace",
    executionReport.artifactId,
  ];
  const convergenceAdvice = latestConvergenceAdvice(taskContextPackage);
  const convergenceFailure = latestArtifactRecord(taskContextPackage, "convergenceFailure");
  const humanConvergenceGuidance = latestArtifactRecord(taskContextPackage, "humanConvergenceGuidance");
  const correctionRefs = [
    convergenceAdvice?.artifactId,
    convergenceFailure?.artifactId,
    humanConvergenceGuidance?.artifactId,
  ].filter(Boolean);
  return correctionRefs.length > 0
    ? [
        "taskDraft",
        "executionAuthorization",
        ...correctionRefs,
        "isolatedWorkspace",
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
  if (!hasIsolatedWorkspace(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能运行 review agent。",
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
