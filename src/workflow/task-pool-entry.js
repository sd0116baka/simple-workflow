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
