import { readFile } from "node:fs/promises";
import { evaluateExecutionAdmission } from "./execution-admission.js";
import { parseRecommendationIntent } from "./recommendation-intent.js";
import { buildRecommendationPrompt } from "./recommendation-prompt.js";
import { OPENCODE_RECOMMENDATION_ARGS } from "./recommendation-runner.js";
import { applyAppendRequest, buildTaskPool, findTaskContextPackage } from "./task-pool.js";

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
    progress: [],
    executionIntent: null,
    executionIntentAppendRequest: null,
    executionIntentError: null,
    executionAdmission: null,
    taskContextPackage: null,
    stdout: "",
    stderr: "",
    exitCode: null,
    error: "启动检查未通过，任务推荐器未运行。",
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
    progress: [],
    executionIntent: null,
    executionIntentAppendRequest: null,
    executionIntentError: null,
    executionAdmission: null,
    taskContextPackage: null,
    stdout: "",
    stderr: "",
    exitCode: null,
    error: null,
    prompt: buildRecommendationPrompt({
      basePrompt,
      candidateTasks: taskPool.views.candidateTasks,
    }),
  };
}

export async function startRecommendationFlow({
  id,
  tasks,
  startupCheck,
  recommendationPromptPath,
  now = () => new Date().toISOString(),
}) {
  const taskPool = buildTaskPool(tasks);
  if (!startupCheck.canStartWork) {
    return {
      run: createBlockedRecommendationRun({ id, startupCheck, now }),
      taskPool,
    };
  }

  const basePrompt = await readFile(recommendationPromptPath, "utf8");
  const run = createRunningRecommendationRun({
    id,
    basePrompt,
    taskPool,
    startupCheck,
    now,
  });
  return { run, taskPool };
}

export function completeRecommendationFlow({
  run,
  commandResult,
  tasks,
  startupCheck,
  projectProfile,
  now = () => new Date().toISOString(),
}) {
  const failed = commandResult.error || commandResult.exitCode !== 0;
  const parsed = failed
    ? { appendRequest: null, intent: null, error: null }
    : parseRecommendationIntent(commandResult.stdout ?? "");
  let taskPool = failed ? null : buildTaskPool(tasks);
  taskPool = failed || !parsed.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, parsed.appendRequest, {
        currentWorkStage: "task-recommender",
      });
  const intentPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);
  const admission = failed || !parsed.appendRequest
    ? null
    : evaluateExecutionAdmission({
        taskContextPackage: intentPackage,
        candidateTasks: taskPool.views.candidateTasks,
        runtimeSnapshot: startupCheck.runtimeSnapshot,
        projectProfile,
      });
  taskPool = failed || !admission?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, admission.appendRequest, {
        currentWorkStage: "execution-admission",
      });
  const taskContextPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);

  return {
    ...run,
    status: failed ? "failed" : "succeeded",
    finishedAt: now(),
    stdout: commandResult.stdout ?? "",
    stderr: commandResult.stderr ?? "",
    exitCode: commandResult.exitCode ?? null,
    error: commandResult.error ?? null,
    executionIntent: parsed.intent,
    executionIntentAppendRequest: parsed.appendRequest,
    executionIntentError: parsed.error,
    executionAdmission: admission,
    taskContextPackage,
  };
}
