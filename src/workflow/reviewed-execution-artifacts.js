import { latestArtifactRecord } from "./task-package-artifacts.js";

function agentRunForOutputArtifact(taskContextPackage, artifactRecord) {
  if (!artifactRecord?.artifactId) return null;
  return taskContextPackage?.agentRuns?.find((agentRun) =>
    agentRun.outputArtifactRefs?.includes(artifactRecord.artifactId)) ?? null;
}

function hasFailedOutputAgentRun(taskContextPackage, artifactRecord) {
  const agentRun = agentRunForOutputArtifact(taskContextPackage, artifactRecord);
  return Boolean(agentRun && agentRun.status !== "succeeded");
}

export function latestExecutionReport(taskContextPackage) {
  return latestArtifactRecord(taskContextPackage, "executionReport");
}

export function latestReviewReport(taskContextPackage) {
  return latestArtifactRecord(taskContextPackage, "reviewReport");
}

export function isUsableExecutionReport(taskContextPackage, executionReport) {
  return Boolean(executionReport)
    && executionReport.body?.status !== "failed"
    && !hasFailedOutputAgentRun(taskContextPackage, executionReport);
}

export function isUsableReviewReport(taskContextPackage, reviewReport) {
  return Boolean(reviewReport)
    && !hasFailedOutputAgentRun(taskContextPackage, reviewReport);
}

export function latestReviewedExecutionArtifacts(taskContextPackage) {
  return {
    executionReport: latestExecutionReport(taskContextPackage),
    reviewReport: latestReviewReport(taskContextPackage),
  };
}
