export function buildReviewReportRequest({
  taskContextPackage,
  runId,
  session,
  inputArtifactRefs,
  outcome = "passed",
  summary = "stub review passed",
  findings = [],
  startedAt,
  finishedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "reviewReport",
    artifact: {
      outcome,
      summary,
      findings,
    },
    agentRun: {
      runId,
      role: "review",
      sessionId: session.sessionId,
      inputArtifactRefs,
      outputArtifactRefs: [],
      status: session.status ?? "succeeded",
      startedAt,
      finishedAt,
    },
  };
}
