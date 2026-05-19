import { readFile } from "node:fs/promises";
import { runConvergence } from "./convergence-flow.js";
import { evaluateExecutionAdmission } from "./execution-admission.js";
import { runExecutionAgent } from "./execution-agent-flow.js";
import { requestHumanDecisionForTaskCompletion } from "./human-decision-flow.js";
import { initializeMainAgent } from "./main-agent-flow.js";
import { parseRecommendationIntent } from "./recommendation-intent.js";
import { buildRecommendationPrompt } from "./recommendation-prompt.js";
import { OPENCODE_RECOMMENDATION_ARGS } from "./recommendation-runner.js";
import { runReviewAgent } from "./review-agent-flow.js";
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
    mainAgentInitialization: null,
    mainAgentInitializationError: null,
    executionAgentRuns: [],
    executionAgentErrors: [],
    reviewAgentRuns: [],
    reviewAgentErrors: [],
    convergenceRuns: [],
    convergenceErrors: [],
    completionHumanDecisionRequest: null,
    completionHumanDecisionError: null,
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
    mainAgentInitialization: null,
    mainAgentInitializationError: null,
    executionAgentRuns: [],
    executionAgentErrors: [],
    reviewAgentRuns: [],
    reviewAgentErrors: [],
    convergenceRuns: [],
    convergenceErrors: [],
    completionHumanDecisionRequest: null,
    completionHumanDecisionError: null,
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
  runMainAgentSession,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
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
  const authorizedPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);
  const mainAgentInitialization =
    !authorizedPackage || admission?.appendRequest?.artifactType !== "executionAuthorization"
      ? null
      : initializeMainAgent({
          taskContextPackage: authorizedPackage,
          runAgentSession: runMainAgentSession,
          now,
        });
  taskPool = !mainAgentInitialization?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, mainAgentInitialization.appendRequest, {
        currentWorkStage: "main-agent",
      });
  const mainInitializedPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);
  const executionAgentRun = !mainInitializedPackage || !mainAgentInitialization?.appendRequest
    ? null
    : runExecutionAgent({
        taskContextPackage: mainInitializedPackage,
        runAgentSession: runExecutionAgentSession,
        now,
      });
  taskPool = !executionAgentRun?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, executionAgentRun.appendRequest, {
        currentWorkStage: "execution-agent",
      });
  const executionCompletedPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);
  const reviewAgentRun = !executionCompletedPackage || !executionAgentRun?.appendRequest
    ? null
    : runReviewAgent({
        taskContextPackage: executionCompletedPackage,
        runAgentSession: runReviewAgentSession,
        now,
      });
  taskPool = !reviewAgentRun?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, reviewAgentRun.appendRequest, {
        currentWorkStage: "review-agent",
      });
  const reviewedPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);
  const convergenceRun = !reviewedPackage || !reviewAgentRun?.appendRequest
    ? null
    : runConvergence({
        taskContextPackage: reviewedPackage,
        runAgentSession: runConvergenceSession,
        now,
      });
  taskPool = !convergenceRun?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, convergenceRun.appendRequest, {
        currentWorkStage: "convergence",
      });
  const convergedPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);
  const nextExecutionAgentRun = !convergedPackage || !convergenceRun?.appendRequest
    ? null
    : runExecutionAgent({
        taskContextPackage: convergedPackage,
        runAgentSession: runExecutionAgentSession,
        now,
      });
  taskPool = !nextExecutionAgentRun?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, nextExecutionAgentRun.appendRequest, {
        currentWorkStage: "execution-agent",
      });
  const secondExecutionCompletedPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);
  const nextReviewAgentRun = !secondExecutionCompletedPackage || !nextExecutionAgentRun?.appendRequest
    ? null
    : runReviewAgent({
        taskContextPackage: secondExecutionCompletedPackage,
        runAgentSession: runReviewAgentSession,
        now,
      });
  taskPool = !nextReviewAgentRun?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, nextReviewAgentRun.appendRequest, {
        currentWorkStage: "review-agent",
      });
  const secondReviewedPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);
  const nextConvergenceRun = !secondReviewedPackage || !nextReviewAgentRun?.appendRequest
    ? null
    : runConvergence({
        taskContextPackage: secondReviewedPackage,
        runAgentSession: runConvergenceSession,
        now,
      });
  taskPool = !nextConvergenceRun?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, nextConvergenceRun.appendRequest, {
        currentWorkStage: nextConvergenceRun.appendRequest.artifactType === "taskCompletion"
          ? "task-completion"
          : "convergence",
      });
  const completedPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);
  const completionHumanDecisionRequest =
    !completedPackage || nextConvergenceRun?.appendRequest?.artifactType !== "taskCompletion"
      ? null
      : requestHumanDecisionForTaskCompletion({
          taskContextPackage: completedPackage,
          now,
        });
  taskPool = !completionHumanDecisionRequest?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, completionHumanDecisionRequest.appendRequest, {
        currentWorkStage: "human-decision",
      });
  const taskContextPackage = failed || !parsed.appendRequest
    ? null
    : findTaskContextPackage(taskPool, parsed.appendRequest.packageId);
  const executionAgentRuns = [
    executionAgentRun,
    nextExecutionAgentRun,
  ].filter(Boolean);
  const reviewAgentRuns = [
    reviewAgentRun,
    nextReviewAgentRun,
  ].filter(Boolean);
  const convergenceRuns = [
    convergenceRun,
    nextConvergenceRun,
  ].filter(Boolean);

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
    mainAgentInitialization,
    mainAgentInitializationError: mainAgentInitialization?.error ?? null,
    executionAgentRuns,
    executionAgentErrors: executionAgentRuns
      .map((agentRun) => agentRun.error)
      .filter(Boolean),
    reviewAgentRuns,
    reviewAgentErrors: reviewAgentRuns
      .map((agentRun) => agentRun.error)
      .filter(Boolean),
    convergenceRuns,
    convergenceErrors: convergenceRuns
      .map((agentRun) => agentRun.error)
      .filter(Boolean),
    completionHumanDecisionRequest,
    completionHumanDecisionError: completionHumanDecisionRequest?.error ?? null,
    taskContextPackage,
  };
}
