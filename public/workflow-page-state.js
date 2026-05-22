import { hasArtifactBody } from "./task-package-artifacts.js";

export function selectExistingTaskFile(tasks = [], currentFileName = null) {
  if (tasks.some((task) => task.fileName === currentFileName)) return currentFileName;
  return tasks[0]?.fileName ?? null;
}

export function findSelectedTask(tasks = [], selectedFileName = null) {
  return tasks.find((task) => task.fileName === selectedFileName) ?? null;
}

export function activeTaskContextPackage({
  selectedFileName = null,
  poolTaskContextPackages = [],
  recommendationRun = null,
} = {}) {
  const selectedPackage = poolTaskContextPackages.find((taskPackage) =>
    taskPackage.source?.path === `tasks/${selectedFileName}`,
  );
  if (selectedPackage) return selectedPackage;
  if (recommendationRun?.taskContextPackage) return recommendationRun.taskContextPackage;
  return poolTaskContextPackages.find((taskPackage) =>
    taskPackage.currentWorkStage === "human-decision"
      && hasArtifactBody(taskPackage, "humanDecisionRequest"),
  ) ?? null;
}

export function mergeRecommendationTaskContextPackage({
  poolTaskContextPackages = [],
  recommendationRun = null,
} = {}) {
  const runPackage = recommendationRun?.taskContextPackage;
  if (!runPackage) return poolTaskContextPackages;
  let didReplace = false;
  const mergedPackages = poolTaskContextPackages.map((taskPackage) => {
    if (taskPackage.packageId !== runPackage.packageId) return taskPackage;
    didReplace = true;
    return runPackage;
  });
  return didReplace ? mergedPackages : poolTaskContextPackages;
}

export function fixtureSelectedFileName(payload = {}, fallbackFileName = null) {
  return payload.tasks?.[0]?.sourcePath?.replace(/^tasks\//, "") ?? fallbackFileName;
}

export function selectionAfterFixtureCleanup(selectedFileName = null) {
  return selectedFileName?.startsWith("stub-") ? null : selectedFileName;
}
