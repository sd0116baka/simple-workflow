import { watch } from "node:fs";
import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  evaluateStartupCheck,
  runtimeSnapshotFromRepositoryStatus,
} from "./execution-admission.js";
import { getRepositoryStatus as readRepositoryStatus } from "./repository-status.js";
import {
  completeRecommendationFlow,
  startRecommendationFlow,
} from "./recommendation-flow.js";
import { runOpencodeRecommendation } from "./recommendation-runner.js";
import { buildTaskPool } from "./task-pool.js";
import { listRawTasks } from "./task-source.js";

const TASK_EXTENSIONS = new Set([".yaml", ".yml"]);

function isTaskFile(fileName) {
  return fileName && TASK_EXTENSIONS.has(extname(String(fileName)).toLowerCase());
}

export function createWorkflowService({
  tasksDir,
  repositoryDir = process.cwd(),
  getRepositoryStatus = () => readRepositoryStatus({ cwd: repositoryDir }),
  recommendationPromptPath = join(repositoryDir, "project_profiles", "recommender-agent.prompt.md"),
  runRecommendationCommand = ({ prompt }) =>
    runOpencodeRecommendation({
      prompt,
      cwd: repositoryDir,
    }),
  watchDebounceMs = 100,
}) {
  const listeners = new Set();
  let watcher = null;
  let debounceTimer = null;
  let latestRecommendationRun = null;
  let recommendationRunSequence = 0;

  function emit(event) {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function toRecommendationSnapshot(run) {
    return run
      ? {
          ...run,
          args: [...run.args],
          startupCheck: run.startupCheck ? JSON.parse(JSON.stringify(run.startupCheck)) : null,
          progress: run.progress.map((entry) => ({ ...entry })),
          executionIntent: run.executionIntent
            ? JSON.parse(JSON.stringify(run.executionIntent))
            : null,
          executionAdmission: run.executionAdmission
            ? JSON.parse(JSON.stringify(run.executionAdmission))
            : null,
          isolatedWorkspaceAllocation: run.isolatedWorkspaceAllocation
            ? JSON.parse(JSON.stringify(run.isolatedWorkspaceAllocation))
            : null,
          isolatedWorkspaceError: run.isolatedWorkspaceError ?? null,
          mainAgentInitialization: run.mainAgentInitialization
            ? JSON.parse(JSON.stringify(run.mainAgentInitialization))
            : null,
          executionAgentRuns: run.executionAgentRuns
            ? JSON.parse(JSON.stringify(run.executionAgentRuns))
            : [],
          executionAgentErrors: run.executionAgentErrors
            ? [...run.executionAgentErrors]
            : [],
          reviewAgentRuns: run.reviewAgentRuns
            ? JSON.parse(JSON.stringify(run.reviewAgentRuns))
            : [],
          reviewAgentErrors: run.reviewAgentErrors
            ? [...run.reviewAgentErrors]
            : [],
          convergenceRuns: run.convergenceRuns
            ? JSON.parse(JSON.stringify(run.convergenceRuns))
            : [],
          convergenceErrors: run.convergenceErrors
            ? [...run.convergenceErrors]
            : [],
          completionHumanDecisionRequest: run.completionHumanDecisionRequest
            ? JSON.parse(JSON.stringify(run.completionHumanDecisionRequest))
            : null,
          completionHumanDecisionError: run.completionHumanDecisionError ?? null,
          executionIntentAppendRequest: run.executionIntentAppendRequest
            ? JSON.parse(JSON.stringify(run.executionIntentAppendRequest))
            : null,
          taskContextPackage: run.taskContextPackage
            ? JSON.parse(JSON.stringify(run.taskContextPackage))
            : null,
        }
      : null;
  }

  async function getStartupCheck() {
    return evaluateStartupCheck({
      runtimeSnapshot: runtimeSnapshotFromRepositoryStatus(await getRepositoryStatus()),
    });
  }

  function emitRecommendationChanged(run) {
    emit({
      type: "recommendation-run-changed",
      run: toRecommendationSnapshot(run),
      timestamp: new Date().toISOString(),
    });
  }

  async function finishRecommendationRun(run, startedCommand) {
    try {
      const result = await startedCommand;
      Object.assign(run, completeRecommendationFlow({
        run,
        commandResult: result,
        tasks: await listRawTasks(tasksDir),
        startupCheck: await getStartupCheck(),
        projectProfile: {
          defaults: {
            maxIterations: 3,
          },
        },
      }));
    } catch (error) {
      Object.assign(run, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error.message,
      });
    }
    emitRecommendationChanged(run);
  }

  return {
    listTasks() {
      return listRawTasks(tasksDir);
    },

    async listTaskPool() {
      return buildTaskPool(await listRawTasks(tasksDir));
    },

    async getStartupCheck() {
      return getStartupCheck();
    },

    async createRecommendationRun() {
      const startupCheck = await getStartupCheck();
      const { run } = await startRecommendationFlow({
        id: `recommendation-run-${(recommendationRunSequence += 1)}`,
        tasks: await listRawTasks(tasksDir),
        startupCheck,
        recommendationPromptPath,
      });
      latestRecommendationRun = run;
      emitRecommendationChanged(run);
      if (run.status !== "running") {
        return toRecommendationSnapshot(run);
      }
      const appendProgress = (progress) => {
        run.progress.push({
          ...progress,
          timestamp: new Date().toISOString(),
        });
        run.progress = run.progress.slice(-20);
        emitRecommendationChanged(run);
      };
      const startedCommand = Promise.resolve().then(() =>
        runRecommendationCommand({
          prompt: run.prompt,
          run: toRecommendationSnapshot(run),
          onProgress: appendProgress,
        }),
      );
      finishRecommendationRun(run, startedCommand);
      return toRecommendationSnapshot(run);
    },

    getLatestRecommendationRun() {
      return toRecommendationSnapshot(latestRecommendationRun);
    },

    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async startWatching() {
      if (watcher) return;
      await mkdir(tasksDir, { recursive: true });
      watcher = watch(tasksDir, (eventType, fileName) => {
        if (!isTaskFile(fileName)) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          emit({
            type: "tasks-changed",
            eventType,
            fileName: String(fileName),
            timestamp: new Date().toISOString(),
          });
        }, watchDebounceMs);
      });
    },

    stopWatching() {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      watcher?.close();
      watcher = null;
      listeners.clear();
    },
  };
}
