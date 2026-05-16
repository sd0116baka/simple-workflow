function toChangedFiles(repositoryStatus) {
  return (repositoryStatus?.entries ?? []).map((entry) => entry.path);
}

export function buildRecommendationPrompt({ basePrompt, runtimeStatus } = {}) {
  const context = {
    schemaVersion: 1,
    candidateTasks: runtimeStatus?.runnableTasks ?? [],
    repoStatus: {
      clean: runtimeStatus?.repositoryStatus?.clean ?? false,
      changedFiles: toChangedFiles(runtimeStatus?.repositoryStatus),
    },
    runtime: {
      status: runtimeStatus?.status ?? "unknown",
      canStartNewTask: runtimeStatus?.canStartNewTask ?? false,
      blockingReasons: runtimeStatus?.blockingReasons ?? [],
    },
  };

  return [
    basePrompt,
    "",
    "系统注入的推荐器输入如下。你只能使用这段 JSON 中的 candidateTasks 作为候选任务与 observedTasks 来源：",
    "",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
    "",
  ].join("\n");
}
