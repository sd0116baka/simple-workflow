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
  return {
    runId,
    role: "main",
    sessionId: session.sessionId,
    inputArtifactRefs,
    outputArtifactRefs: [],
    status: session.status ?? "succeeded",
    startedAt,
    finishedAt,
  };
}

export function buildConvergenceAdviceRequest({
  taskContextPackage,
  runId,
  session,
  inputArtifactRefs,
  executionReport,
  reviewReport,
  summary = "stub convergence advice",
  nextAction = "等待真实 main agent 根据执行和审查结果给出下一轮执行意见。",
  startedAt,
  finishedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "convergenceAdvice",
    artifact: {
      summary,
      nextAction,
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
  summary = "stub task completed",
  startedAt,
  finishedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "convergenceSuccess",
    artifact: {
      summary,
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
  summary = "当前轮次无法自动收敛。",
  reasonCode = "max-iterations-reached",
  humanDecisionQuestion = "请提供人工收敛意见继续下一轮，或取消任务并恢复执行前状态。",
  startedAt,
  finishedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "convergenceFailure",
    artifact: {
      summary,
      reasonCode,
      basisRefs: basisRefsFor(executionReport, reviewReport),
      attemptedFixes: attemptedFixRefs,
      unresolvedIssues: reviewReport.body?.findings ?? [],
      humanDecisionQuestion,
      maxIterations,
      completedIterations,
    },
    agentRun: agentRun({ runId, session, inputArtifactRefs, startedAt, finishedAt }),
  };
}
