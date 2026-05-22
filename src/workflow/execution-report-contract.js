import { normalizePathForGit } from "./git-path.js";

export function buildExecutionReportRequest({
  taskContextPackage,
  runId,
  session,
  inputArtifactRefs,
  reportCwd,
  changedFiles,
  startedAt,
  finishedAt,
}) {
  const status = session.status ?? "succeeded";
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "executionReport",
    artifact: {
      summary: session.summary ?? "stub execution completed",
      status,
      cwd: normalizePathForGit(reportCwd),
      changedFiles,
      tests: session.tests ?? [],
      notes: session.notes ?? [],
      rawOutput: session.rawOutput ?? null,
    },
    agentRun: {
      runId,
      role: "execution",
      sessionId: session.sessionId,
      inputArtifactRefs,
      outputArtifactRefs: [],
      status,
      startedAt,
      finishedAt,
    },
  };
}
