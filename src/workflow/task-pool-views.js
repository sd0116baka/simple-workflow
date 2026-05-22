import { cloneJsonValue } from "./json-value.js";

export function buildTaskPoolViews(taskContextPackages) {
  return {
    candidateTasks: taskContextPackages
      .filter((taskPackage) =>
        taskPackage.qualityGate.outcome === "pass"
          && taskPackage.currentWorkStage === "task-pool")
      .map((taskPackage) => ({
        packageId: taskPackage.packageId,
        taskDraft: cloneJsonValue(taskPackage.taskDraft),
      })),
    needsAttention: taskContextPackages
      .filter((taskPackage) => taskPackage.recognition.outcome === "incomplete")
      .map((taskPackage) => taskPackage.packageId),
    brokenContent: [],
  };
}
