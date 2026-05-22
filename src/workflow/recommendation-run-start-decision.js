import { readFile } from "node:fs/promises";
import {
  createBlockedRecommendationRun,
  createRunningRecommendationRun,
} from "./recommendation-run-records.js";
import { buildTaskPool } from "./task-pool.js";

export async function decideRecommendationRunStart({
  id,
  mode = "workflow",
  tasks,
  startupCheck,
  recommendationPromptPath,
  existingTaskContextPackages = [],
  now = () => new Date().toISOString(),
  readPrompt = (promptPath) => readFile(promptPath, "utf8"),
}) {
  const taskPool = buildTaskPool(tasks, {
    taskContextPackages: existingTaskContextPackages,
  });
  if (!startupCheck.canStartWork) {
    return {
      run: createBlockedRecommendationRun({ id, mode, startupCheck, now }),
      taskPool,
    };
  }

  if (taskPool.views.candidateTasks.length === 0) {
    return {
      run: createBlockedRecommendationRun({
        id,
        mode,
        startupCheck: buildNoCandidateStartupCheck(startupCheck),
        now,
      }),
      taskPool,
    };
  }

  const basePrompt = await readPrompt(recommendationPromptPath);
  const run = createRunningRecommendationRun({
    id,
    mode,
    basePrompt,
    taskPool,
    startupCheck,
    now,
  });
  return { run, taskPool };
}

export function buildNoCandidateStartupCheck(startupCheck) {
  return {
    ...startupCheck,
    canStartWork: false,
    error: "没有可推荐候选任务。",
    findings: [
      ...(startupCheck.findings ?? []),
      {
        field: "candidateTasks",
        severity: "blocking",
        code: "NO_CANDIDATE_TASKS",
        message: "任务池中没有可启动任务。",
      },
    ],
  };
}
