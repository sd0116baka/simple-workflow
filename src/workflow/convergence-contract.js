import { buildAgentRunRecord } from "./agent-session-contract.js";

function basisRefsFor(executionReport, reviewReport) {
  return [
    executionReport.artifactId,
    reviewReport.artifactId,
  ];
}

function agentRun({
  runId,
  session,
  inputArtifactRefs,
  startedAt,
  finishedAt,
}) {
  return buildAgentRunRecord({
    runId,
    role: "main",
    session,
    inputArtifactRefs,
    startedAt,
    finishedAt,
  });
}

export function buildConvergenceAdviceRequest({
  taskContextPackage,
  runId,
  session,
  inputArtifactRefs,
  executionReport,
  reviewReport,
  summary,
  nextAction,
  startedAt,
  finishedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "convergenceAdvice",
    artifact: {
      summary: summary ?? session.summary ?? "stub convergence advice",
      nextAction: nextAction ?? session.nextAction ?? "等待真实 main agent 根据执行和审查结果给出下一轮执行意见。",
      basis: basisRefsFor(executionReport, reviewReport),
    },
    agentRun: agentRun({ runId, session, inputArtifactRefs, startedAt, finishedAt }),
  };
}

export function buildConvergenceSuccessRequest({
  taskContextPackage,
  runId,
  session,
  inputArtifactRefs,
  executionReport,
  reviewReport,
  summary,
  startedAt,
  finishedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "convergenceSuccess",
    artifact: {
      summary: summary ?? session.summary ?? "stub task completed",
      basis: basisRefsFor(executionReport, reviewReport),
    },
    agentRun: agentRun({ runId, session, inputArtifactRefs, startedAt, finishedAt }),
  };
}

export function buildConvergenceFailureRequest({
  taskContextPackage,
  runId,
  session,
  inputArtifactRefs,
  executionReport,
  reviewReport,
  attemptedFixRefs,
  maxIterations,
  completedIterations,
  summary,
  reasonCode,
  humanDecisionQuestion,
  startedAt,
  finishedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "convergenceFailure",
    artifact: {
      summary: summary ?? session.summary ?? "当前轮次无法自动收敛。",
      reasonCode: reasonCode ?? session.reasonCode ?? "max-iterations-reached",
      basisRefs: basisRefsFor(executionReport, reviewReport),
      attemptedFixes: attemptedFixRefs,
      unresolvedIssues: reviewReport.body?.findings ?? [],
      humanDecisionQuestion: humanDecisionQuestion
        ?? session.humanDecisionQuestion
        ?? "请提供人工收敛意见继续下一轮，或取消任务并恢复执行前状态。",
      maxIterations,
      completedIterations,
    },
    agentRun: agentRun({ runId, session, inputArtifactRefs, startedAt, finishedAt }),
  };
}
