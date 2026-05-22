import { createEmptyRecommendationRunFields } from "./recommendation-run-field-defaults.js";
import { OPENCODE_RECOMMENDATION_ARGS } from "./recommendation-runner.js";
import { normalizeWorkflowStageSwitches } from "./workflow-stage-switches.js";

export function createBlockedRecommendationRun({
  id,
  mode = "workflow",
  stageSwitches = normalizeWorkflowStageSwitches(),
  startupCheck,
  now = () => new Date().toISOString(),
}) {
  const timestamp = now();
  return {
    id,
    mode,
    stageSwitches: normalizeWorkflowStageSwitches(stageSwitches),
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
  mode = "workflow",
  stageSwitches = normalizeWorkflowStageSwitches(),
  basePrompt,
  taskPool,
  startupCheck,
  now = () => new Date().toISOString(),
}) {
  return {
    id,
    mode,
    stageSwitches: normalizeWorkflowStageSwitches(stageSwitches),
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
