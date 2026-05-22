export function buildReviewReportRequest({
  taskContextPackage,
  runId,
  session,
  inputArtifactRefs,
  outcome,
  summary,
  findings,
  startedAt,
  finishedAt,
}) {
  const reportOutcome = outcome ?? session.outcome ?? "passed";
  const reportFindings = findings ?? session.findings ?? [];
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "reviewReport",
    artifact: {
      outcome: reportOutcome,
      summary: summary ?? session.summary ?? "stub review passed",
      findings: reportFindings,
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
