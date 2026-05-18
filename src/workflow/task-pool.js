export function buildTaskPool(tasks) {
  const entries = tasks
    .filter((task) => task.parseError === null && task.parsed)
    .map((task) => ({
      id: task.parsed.id ?? task.id,
      packageId: `task-context-package:tasks/${task.fileName}`,
      sourceFile: task.fileName,
      title: task.parsed.title ?? null,
      type: task.parsed.type ?? null,
      priority: task.parsed.priority ?? null,
      status: task.validation?.status === "valid" ? "ready" : "blocked",
      parsed: task.parsed,
      validation: task.validation,
    }));

  return {
    entries,
    views: {
      candidateTasks: entries
        .filter((entry) => entry.status === "ready")
        .map((entry) => ({
          packageId: entry.packageId,
          id: entry.id,
          title: entry.title,
          type: entry.type,
          priority: entry.priority,
          sourceFile: entry.sourceFile,
        })),
      needsAttention: entries
        .filter((entry) => entry.status !== "ready")
        .map((entry) => entry.packageId),
      brokenContent: [],
    },
  };
}
