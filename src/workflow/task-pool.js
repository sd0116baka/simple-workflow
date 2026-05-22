import {
  applyAppendRequestToTaskPackage,
} from "./task-package-append-request.js";
import { assertAppendRequest } from "./task-package-append-validation.js";
import {
  entryStatusFromPackage,
  taskPoolEntriesFromSources,
} from "./task-pool-entry.js";
import { taskContextPackagesFromEntries } from "./task-context-package-build.js";
import { buildTaskPoolViews } from "./task-pool-views.js";

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
