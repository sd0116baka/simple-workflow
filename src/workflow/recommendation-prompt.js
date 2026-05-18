export function buildRecommendationPrompt({ basePrompt, candidateTasks = [], startupCheck } = {}) {
  const context = {
    schemaVersion: 1,
    candidateTasks,
    repoStatus: {
      clean: startupCheck?.runtimeSnapshot?.worktree?.clean ?? false,
      changedFiles: startupCheck?.runtimeSnapshot?.worktree?.changedFiles ?? [],
    },
    startupCheck: {
      canStartWork: startupCheck?.canStartWork ?? false,
      findings: startupCheck?.findings ?? [],
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
