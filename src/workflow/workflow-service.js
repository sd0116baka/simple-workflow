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
import { executeAutoMerge, planAutoMerge } from "./auto-merge-flow.js";
import { acceptTaskCompletion } from "./human-decision-flow.js";
import { runOpencodeRecommendation } from "./recommendation-runner.js";
import { closeTask } from "./task-closeout-flow.js";
import { applyAppendRequest, buildTaskPool } from "./task-pool.js";
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
          autoMergePlanning: run.autoMergePlanning
            ? JSON.parse(JSON.stringify(run.autoMergePlanning))
            : null,
          autoMergePlanningError: run.autoMergePlanningError ?? null,
          autoMergeExecution: run.autoMergeExecution
            ? JSON.parse(JSON.stringify(run.autoMergeExecution))
            : null,
          autoMergeExecutionError: run.autoMergeExecutionError ?? null,
          taskCloseout: run.taskCloseout
            ? JSON.parse(JSON.stringify(run.taskCloseout))
            : null,
          taskCloseoutError: run.taskCloseoutError ?? null,
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
        repositoryDir,
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
      return buildTaskPool(await listRawTasks(tasksDir), {
        taskContextPackages: latestRecommendationRun?.taskContextPackage
          ? [latestRecommendationRun.taskContextPackage]
          : [],
      });
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

    async acceptTaskCompletion() {
      if (!latestRecommendationRun?.taskContextPackage) {
        return {
          accepted: false,
          error: "没有可接受的任务上下文包。",
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      const decision = acceptTaskCompletion({
        taskContextPackage: latestRecommendationRun.taskContextPackage,
        repositoryDir,
      });
      if (!decision.appendRequest) {
        latestRecommendationRun.completionHumanDecisionError = decision.error;
        emitRecommendationChanged(latestRecommendationRun);
        return {
          accepted: false,
          error: decision.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      let taskPool = applyAppendRequest(
        buildTaskPool(await listRawTasks(tasksDir), {
          taskContextPackages: [latestRecommendationRun.taskContextPackage],
        }),
        decision.appendRequest,
        { currentWorkStage: "auto-merge" },
      );
      latestRecommendationRun.taskContextPackage =
        taskPool.taskContextPackages.find((taskPackage) =>
          taskPackage.packageId === decision.appendRequest.packageId,
        ) ?? latestRecommendationRun.taskContextPackage;
      latestRecommendationRun.completionHumanDecisionError = null;

      const planning = planAutoMerge({
        taskContextPackage: latestRecommendationRun.taskContextPackage,
        repositoryDir,
      });
      if (!planning.appendRequest) {
        latestRecommendationRun.autoMergePlanningError = planning.error;
        emitRecommendationChanged(latestRecommendationRun);
        return {
          accepted: true,
          planned: false,
          closed: false,
          error: planning.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      taskPool = applyAppendRequest(
        buildTaskPool(await listRawTasks(tasksDir), {
          taskContextPackages: [latestRecommendationRun.taskContextPackage],
        }),
        planning.appendRequest,
        {
          currentWorkStage: planning.appendRequest.artifactType === "autoMergePlan"
            ? "auto-merge-execution"
            : "auto-merge",
        },
      );
      latestRecommendationRun.taskContextPackage =
        taskPool.taskContextPackages.find((taskPackage) =>
          taskPackage.packageId === planning.appendRequest.packageId,
        ) ?? latestRecommendationRun.taskContextPackage;
      latestRecommendationRun.autoMergePlanning = planning;
      latestRecommendationRun.autoMergePlanningError = null;
      if (planning.appendRequest.artifactType !== "autoMergePlan") {
        emitRecommendationChanged(latestRecommendationRun);
        return {
          accepted: true,
          planned: false,
          executed: false,
          closed: false,
          error: null,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      const execution = executeAutoMerge({
        taskContextPackage: latestRecommendationRun.taskContextPackage,
        repositoryDir,
      });
      if (!execution.appendRequest) {
        latestRecommendationRun.autoMergeExecutionError = execution.error;
        emitRecommendationChanged(latestRecommendationRun);
        return {
          accepted: true,
          planned: true,
          executed: false,
          error: execution.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      taskPool = applyAppendRequest(
        buildTaskPool(await listRawTasks(tasksDir), {
          taskContextPackages: [latestRecommendationRun.taskContextPackage],
        }),
        execution.appendRequest,
        {
          currentWorkStage: execution.appendRequest.artifactType === "autoMergeResult"
            ? "merged"
            : "auto-merge-execution",
        },
      );
      latestRecommendationRun.taskContextPackage =
        taskPool.taskContextPackages.find((taskPackage) =>
          taskPackage.packageId === execution.appendRequest.packageId,
        ) ?? latestRecommendationRun.taskContextPackage;
      latestRecommendationRun.autoMergeExecution = execution;
      latestRecommendationRun.autoMergeExecutionError = null;
      if (execution.appendRequest.artifactType !== "autoMergeResult") {
        emitRecommendationChanged(latestRecommendationRun);
        return {
          accepted: true,
          planned: true,
          executed: false,
          closed: false,
          error: null,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      const closeout = closeTask({
        taskContextPackage: latestRecommendationRun.taskContextPackage,
        repositoryDir,
      });
      if (!closeout.appendRequest) {
        latestRecommendationRun.taskCloseoutError = closeout.error;
        emitRecommendationChanged(latestRecommendationRun);
        return {
          accepted: true,
          planned: true,
          executed: true,
          closed: false,
          error: closeout.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      taskPool = applyAppendRequest(
        buildTaskPool(await listRawTasks(tasksDir), {
          taskContextPackages: [latestRecommendationRun.taskContextPackage],
        }),
        closeout.appendRequest,
        { currentWorkStage: "closed" },
      );
      latestRecommendationRun.taskContextPackage =
        taskPool.taskContextPackages.find((taskPackage) =>
          taskPackage.packageId === closeout.appendRequest.packageId,
        ) ?? latestRecommendationRun.taskContextPackage;
      latestRecommendationRun.taskCloseout = closeout;
      latestRecommendationRun.taskCloseoutError = null;
      emitRecommendationChanged(latestRecommendationRun);

      return {
        accepted: true,
        planned: planning.appendRequest.artifactType === "autoMergePlan",
        executed: execution.appendRequest.artifactType === "autoMergeResult",
        closed: true,
        error: null,
        recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
      };
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
