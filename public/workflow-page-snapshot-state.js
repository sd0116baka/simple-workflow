import {
  mergeRecommendationTaskContextPackage,
  selectExistingTaskFile,
} from "./workflow-page-state.js";

export function createEmptyWorkflowPageSnapshotState() {
  return {
    tasks: [],
    poolEntries: [],
    poolTaskContextPackages: [],
    startupCheck: null,
    selectedFileName: null,
  };
}

export function applyWorkflowPageSnapshot({
  snapshot,
  selectedFileName,
}) {
  const tasks = snapshot.tasks ?? [];

  return {
    tasks,
    poolEntries: snapshot.taskPool?.entries ?? [],
    poolTaskContextPackages: snapshot.taskPool?.taskContextPackages ?? [],
    startupCheck: snapshot.startupCheck ?? null,
    selectedFileName: selectExistingTaskFile(tasks, selectedFileName),
  };
}

export function syncWorkflowPageSnapshotRecommendationPackage({
  snapshotState,
  recommendationRun,
}) {
  return {
    ...snapshotState,
    poolTaskContextPackages: mergeRecommendationTaskContextPackage({
      poolTaskContextPackages: snapshotState.poolTaskContextPackages,
      recommendationRun,
    }),
  };
}
