import { latestArtifactRecord } from "./task-package-artifacts.js";

export function latestExecutionReport(taskContextPackage) {
  return latestArtifactRecord(taskContextPackage, "executionReport");
}

export function latestReviewReport(taskContextPackage) {
  return latestArtifactRecord(taskContextPackage, "reviewReport");
}

export function latestReviewedExecutionArtifacts(taskContextPackage) {
  return {
    executionReport: latestExecutionReport(taskContextPackage),
    reviewReport: latestReviewReport(taskContextPackage),
  };
}
