export function evaluateRuntime(taskPool, repositoryStatus = { clean: true, entries: [] }) {
  const runnableTasks = taskPool.entries
    .filter((entry) => entry.status === "ready")
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      type: entry.type,
      priority: entry.priority,
      sourceFile: entry.sourceFile,
    }));

  const blockingReasons = [];
  if (runnableTasks.length === 0) {
    blockingReasons.push("No ready tasks in task pool");
  }
  if (!repositoryStatus.clean) {
    blockingReasons.push("Working tree has uncommitted changes");
  }

  if (blockingReasons.length > 0) {
    return {
      status: "blocked",
      canStartNewTask: false,
      runnableTasks,
      blockingReasons,
      repositoryStatus,
    };
  }

  return {
    status: "idle",
    canStartNewTask: true,
    runnableTasks,
    blockingReasons: [],
    repositoryStatus,
  };
}
