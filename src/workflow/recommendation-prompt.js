export function buildRecommendationPrompt({ basePrompt, candidateTasks = [] } = {}) {
  const context = {
    candidateTasks,
  };

  return [
    basePrompt,
    "",
    "系统注入的推荐器输入如下。你只能使用这段 JSON 中的 candidateTasks 作为候选任务来源：",
    "",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
    "",
  ].join("\n");
}
