import {
  applyAppendRequestToTaskPackage,
} from "./task-package-append-request.js";
import { assertAppendRequest } from "./task-package-append-validation.js";
import { taskContextPackagesFromEntries } from "./task-context-package-build.js";
import { cloneJsonValue } from "./json-value.js";

export function buildTaskPool(tasks, existingTaskPool = null) {
  const entries = taskPoolEntriesFromSources(tasks);
  const taskContextPackages = taskContextPackagesFromEntries(entries, existingTaskPool);
  const packagesById = new Map(taskContextPackages.map((taskPackage) => [
    taskPackage.packageId,
    taskPackage,
  ]));
  const entriesWithWorkflowStatus = entries.map((entry) => ({
    ...entry,
    status: entryStatusFromPackage(entry, packagesById.get(entry.packageId)),
  }));

  return {
    entries: entriesWithWorkflowStatus,
    taskContextPackages,
    views: buildTaskPoolViews(taskContextPackages),
  };
}

export function findTaskContextPackage(taskPool, packageId) {
  return taskPool?.taskContextPackages?.find((taskPackage) => taskPackage.packageId === packageId) ?? null;
}

export function applyAppendRequest(taskPool, appendRequest, { currentWorkStage } = {}) {
  assertAppendRequest(appendRequest);

  const target = findTaskContextPackage(taskPool, appendRequest.packageId);
  if (!target) {
    throw new Error(`Task context package not found: ${appendRequest.packageId}`);
  }

  const updatedPackages = taskPool.taskContextPackages.map((taskPackage) => {
    if (taskPackage.packageId !== appendRequest.packageId) return taskPackage;
    return applyAppendRequestToTaskPackage(taskPackage, appendRequest, { currentWorkStage });
  });

  return {
    ...taskPool,
    taskContextPackages: updatedPackages,
    views: buildTaskPoolViews(updatedPackages),
  };
}

export function taskPoolEntryFromSource(task) {
  return {
    id: task.parsed.id ?? task.id,
    packageId: `task-context-package:tasks/${task.fileName}`,
    sourceFile: task.fileName,
    title: task.parsed.title ?? null,
    type: task.parsed.type ?? null,
    priority: task.parsed.priority ?? null,
    status: task.validation?.status === "valid" ? "ready" : "blocked",
    parsed: task.parsed,
    validation: task.validation,
  };
}

export function taskPoolEntriesFromSources(tasks) {
  return tasks
    .filter((task) => task.parseError === null && task.parsed)
    .map(taskPoolEntryFromSource);
}

export function entryStatusFromPackage(entry, taskPackage) {
  if (entry.status !== "ready") return entry.status;
  return taskPackage.currentWorkStage === "task-pool"
    ? "ready"
    : taskPackage.currentWorkStage;
}

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
