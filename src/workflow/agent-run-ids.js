import { multiArtifactRecordCount } from "./task-package-artifacts.js";

function numberedRunId(prefix, index) {
  return `${prefix}:${String(index).padStart(3, "0")}`;
}

function nextIndexFromMultiArtifact(taskContextPackage, artifactType) {
  return multiArtifactRecordCount(taskContextPackage, artifactType) + 1;
}

export function nextExecutionAgentRunId(taskContextPackage) {
  return numberedRunId(
    "execution-agent",
    nextIndexFromMultiArtifact(taskContextPackage, "executionReport"),
  );
}

export function nextReviewAgentRunId(taskContextPackage) {
  return numberedRunId(
    "review-agent",
    nextIndexFromMultiArtifact(taskContextPackage, "reviewReport"),
  );
}

export function nextConvergenceAgentRunId(taskContextPackage) {
  return numberedRunId(
    "main-agent:convergence",
    nextIndexFromMultiArtifact(taskContextPackage, "convergenceAdvice"),
  );
}
