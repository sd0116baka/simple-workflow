export function buildTaskPool(tasks) {
  return {
    entries: tasks
      .filter((task) => task.parseError === null && task.parsed)
      .map((task) => ({
        id: task.parsed.id ?? task.id,
        sourceFile: task.fileName,
        title: task.parsed.title ?? null,
        type: task.parsed.type ?? null,
        priority: task.parsed.priority ?? null,
        status: task.validation?.status === "valid" ? "ready" : "blocked",
        parsed: task.parsed,
        validation: task.validation,
      })),
  };
}
