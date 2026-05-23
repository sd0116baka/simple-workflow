import { buildAgentRunRecord } from "./agent-session-contract.js";

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
    agentRun: buildAgentRunRecord({
      runId,
      role: "review",
      session,
      inputArtifactRefs,
      startedAt,
      finishedAt,
    }),
  };
}
