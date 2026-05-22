import { buildRecommendationPrompt } from "./recommendation-prompt.js";
import { createEmptyRecommendationRunFields } from "./recommendation-run-field-defaults.js";
import { OPENCODE_RECOMMENDATION_ARGS } from "./recommendation-runner.js";

export function createBlockedRecommendationRun({ id, startupCheck, now = () => new Date().toISOString() }) {
  const timestamp = now();
  return {
    id,
    status: "blocked",
    startedAt: timestamp,
    finishedAt: timestamp,
    command: null,
    args: [],
    startupCheck,
    ...createEmptyRecommendationRunFields(),
    error: startupCheck.error ?? "启动检查未通过，任务推荐器未运行。",
  };
}

export function createRunningRecommendationRun({
  id,
  basePrompt,
  taskPool,
  startupCheck,
  now = () => new Date().toISOString(),
}) {
  return {
    id,
    status: "running",
    startedAt: now(),
    finishedAt: null,
    command: "opencode",
    args: OPENCODE_RECOMMENDATION_ARGS,
    startupCheck,
    ...createEmptyRecommendationRunFields(),
    error: null,
    prompt: buildRecommendationPrompt({
      basePrompt,
      candidateTasks: taskPool.views.candidateTasks,
    }),
  };
}
