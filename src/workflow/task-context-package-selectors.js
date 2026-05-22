import { artifactBody, hasArtifactBody } from "./task-package-artifacts.js";

const INACTIVE_WORK_STAGES = new Set(["task-pool", "closed", "cancelled"]);

export function latestRunPackage(latestRecommendationRun) {
  return latestRecommendationRun?.taskContextPackage?.packageId
    ? latestRecommendationRun.taskContextPackage
    : null;
}

export function mergeLatestRunPackage(taskContextPackages, latestRecommendationRun) {
  const packagesById = new Map(
    taskContextPackages.map((taskContextPackage) => [
      taskContextPackage.packageId,
      taskContextPackage,
    ]),
  );
  const latestPackage = latestRunPackage(latestRecommendationRun);
  if (latestPackage) {
    packagesById.set(latestPackage.packageId, latestPackage);
  }
  return [...packagesById.values()];
}

function humanDecisionRequestOptions(taskContextPackage) {
  const request = artifactBody(taskContextPackage, "humanDecisionRequest");
  return Array.isArray(request?.decisionOptions) ? request.decisionOptions : [];
}

export function findActiveWork(taskContextPackages) {
  const activePackage = taskContextPackages.find((taskContextPackage) =>
    !INACTIVE_WORK_STAGES.has(taskContextPackage.currentWorkStage),
  );
  if (!activePackage) return null;
  return {
    packageId: activePackage.packageId,
    currentWorkStage: activePackage.currentWorkStage,
    taskName: activePackage.taskDraft?.name ?? null,
    sourcePath: activePackage.source?.path ?? null,
  };
}

export function findAcceptableTaskContextPackage({
  taskContextPackages,
  latestRecommendationRun = null,
  packageId = null,
} = {}) {
  if (packageId) {
    return taskContextPackages.find((candidate) => candidate.packageId === packageId) ?? null;
  }
  const latestPackage = latestRunPackage(latestRecommendationRun);
  if (latestPackage?.currentWorkStage === "human-decision") {
    return latestPackage;
  }
  return taskContextPackages.find((candidate) =>
    candidate.currentWorkStage === "human-decision"
      && humanDecisionRequestOptions(candidate).includes("accept-convergence"),
  ) ?? null;
}

export function findAutoMergePlannablePackage({
  taskContextPackages,
  packageId = null,
} = {}) {
  if (packageId) {
    return taskContextPackages.find((candidate) => candidate.packageId === packageId) ?? null;
  }
  return taskContextPackages.find((candidate) =>
    artifactBody(candidate, "humanDecision")?.decision === "accept-convergence"
      && !hasArtifactBody(candidate, "taskCloseout"),
  ) ?? null;
}

function matchesGuidableDecision(candidate) {
  return candidate.currentWorkStage === "human-decision"
    && humanDecisionRequestOptions(candidate).includes("continue-convergence-with-guidance");
}

function matchesCancellableDecision(candidate) {
  return candidate.currentWorkStage === "human-decision"
    && humanDecisionRequestOptions(candidate).includes("cancel-task");
}

function findHumanDecisionPackage({
  taskContextPackages,
  latestRecommendationRun = null,
  packageId = null,
  matches,
}) {
  if (packageId) {
    const candidate = taskContextPackages.find((item) => item.packageId === packageId) ?? null;
    return candidate && matches(candidate) ? candidate : null;
  }
  const latestPackage = latestRunPackage(latestRecommendationRun);
  if (latestPackage && matches(latestPackage)) {
    return latestPackage;
  }
  return taskContextPackages.find(matches) ?? null;
}

export function findGuidableConvergenceDecisionPackage(options = {}) {
  return findHumanDecisionPackage({
    ...options,
    matches: matchesGuidableDecision,
  });
}

export function findCancellableHumanDecisionPackage(options = {}) {
  return findHumanDecisionPackage({
    ...options,
    matches: matchesCancellableDecision,
  });
}
