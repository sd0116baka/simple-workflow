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
import { runOpencodeExecutionAgentSession } from "./execution-agent-flow.js";
import { executeAutoMerge, planAutoMerge } from "./auto-merge-flow.js";
import { acceptTaskCompletion } from "./human-decision-flow.js";
import { runOpencodeRecommendation } from "./recommendation-runner.js";
import { closeTask } from "./task-closeout-flow.js";
import {
  loadTaskContextPackages,
  saveTaskContextPackage,
} from "./task-context-package-store.js";
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
  taskContextPackageStoreDir = join(repositoryDir, ".workflow", "task-context-packages"),
  runRecommendationCommand = ({ prompt }) =>
    runOpencodeRecommendation({
      prompt,
      cwd: repositoryDir,
    }),
  runExecutionAgentSession = runOpencodeExecutionAgentSession,
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

  async function loadExistingTaskContextPackages() {
    const packagesById = new Map(
      (await loadTaskContextPackages({ storeDir: taskContextPackageStoreDir }))
        .map((taskContextPackage) => [
          taskContextPackage.packageId,
          taskContextPackage,
        ]),
    );
    if (latestRecommendationRun?.taskContextPackage?.packageId) {
      packagesById.set(
        latestRecommendationRun.taskContextPackage.packageId,
        latestRecommendationRun.taskContextPackage,
      );
    }
    return [...packagesById.values()];
  }

  async function persistTaskContextPackage(taskContextPackage) {
    if (!taskContextPackage?.packageId) return;
    await saveTaskContextPackage({
      storeDir: taskContextPackageStoreDir,
      taskContextPackage,
    });
  }

  async function buildCurrentTaskPool() {
    return buildTaskPool(await listRawTasks(tasksDir), {
      taskContextPackages: await loadExistingTaskContextPackages(),
    });
  }

  async function findAcceptableTaskContextPackage(packageId) {
    const taskContextPackages = await loadExistingTaskContextPackages();
    if (packageId) {
      return taskContextPackages.find((candidate) => candidate.packageId === packageId) ?? null;
    }
    if (latestRecommendationRun?.taskContextPackage?.currentWorkStage === "human-decision") {
      return latestRecommendationRun.taskContextPackage;
    }
    return taskContextPackages.find((candidate) =>
      candidate.currentWorkStage === "human-decision"
        && candidate.artifacts?.humanDecisionRequest?.body
        && !candidate.artifacts?.humanDecision?.body,
    ) ?? null;
  }

  async function findAutoMergeExecutablePackage(packageId) {
    const taskContextPackages = await loadExistingTaskContextPackages();
    if (packageId) {
      return taskContextPackages.find((candidate) => candidate.packageId === packageId) ?? null;
    }
    return taskContextPackages.find((candidate) =>
      candidate.currentWorkStage === "auto-merge-execution"
        && candidate.artifacts?.autoMergePlan?.body
        && !candidate.artifacts?.autoMergeResult?.body,
    ) ?? null;
  }

  function ensureLatestRecommendationRun(taskContextPackage) {
    if (!latestRecommendationRun || latestRecommendationRun.status === "running") {
      latestRecommendationRun = {
        id: "manual-workflow-action",
        status: "succeeded",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        command: null,
        args: [],
        startupCheck: null,
        progress: [],
      };
    }
    latestRecommendationRun.taskContextPackage = taskContextPackage;
  }

  async function applyAndPersistAppendRequest(appendRequest, { currentWorkStage }) {
    const taskPool = applyAppendRequest(
      buildTaskPool(await listRawTasks(tasksDir), {
        taskContextPackages: await loadExistingTaskContextPackages(),
      }),
      appendRequest,
      { currentWorkStage },
    );
    const taskContextPackage = taskPool.taskContextPackages.find((candidate) =>
      candidate.packageId === appendRequest.packageId,
    ) ?? null;
    if (taskContextPackage) {
      latestRecommendationRun.taskContextPackage = taskContextPackage;
      await persistTaskContextPackage(taskContextPackage);
    }
    return taskPool;
  }

  async function finishRecommendationRun(run, startedCommand) {
    try {
      const result = await startedCommand;
      Object.assign(run, await completeRecommendationFlow({
        run,
        commandResult: result,
        tasks: await listRawTasks(tasksDir),
        startupCheck: await getStartupCheck(),
        projectProfile: {
          defaults: {
            maxIterations: 3,
          },
        },
        existingTaskContextPackages: await loadExistingTaskContextPackages(),
        runExecutionAgentSession,
        repositoryDir,
      }));
      await persistTaskContextPackage(run.taskContextPackage);
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
      return buildCurrentTaskPool();
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
        existingTaskContextPackages: await loadExistingTaskContextPackages(),
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

    async acceptTaskCompletion({ packageId = null } = {}) {
      const taskContextPackage = await findAcceptableTaskContextPackage(packageId);
      if (!taskContextPackage) {
        return {
          accepted: false,
          error: packageId
            ? `没有找到可接受的任务上下文包：${packageId}`
            : "没有可接受的任务上下文包。",
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      ensureLatestRecommendationRun(taskContextPackage);

      const decision = acceptTaskCompletion({
        taskContextPackage,
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

      let taskPool = await applyAndPersistAppendRequest(
        decision.appendRequest,
        { currentWorkStage: "auto-merge" },
      );
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

      taskPool = await applyAndPersistAppendRequest(
        planning.appendRequest,
        {
          currentWorkStage: planning.appendRequest.artifactType === "autoMergePlan"
            ? "auto-merge-execution"
            : "auto-merge",
        },
      );
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

      taskPool = await applyAndPersistAppendRequest(
        execution.appendRequest,
        {
          currentWorkStage: execution.appendRequest.artifactType === "autoMergeResult"
            ? "merged"
            : "auto-merge-execution",
        },
      );
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

      taskPool = await applyAndPersistAppendRequest(
        closeout.appendRequest,
        { currentWorkStage: "closed" },
      );
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

    async retryAutoMerge({ packageId = null } = {}) {
      const taskContextPackage = await findAutoMergeExecutablePackage(packageId);
      if (!taskContextPackage) {
        return {
          executed: false,
          closed: false,
          error: packageId
            ? `没有找到可重新执行自动合并的任务上下文包：${packageId}`
            : "没有可重新执行自动合并的任务上下文包。",
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      ensureLatestRecommendationRun(taskContextPackage);
      if (taskContextPackage.currentWorkStage === "merged") {
        const closeout = closeTask({
          taskContextPackage: latestRecommendationRun.taskContextPackage,
          repositoryDir,
        });
        if (!closeout.appendRequest) {
          latestRecommendationRun.taskCloseoutError = closeout.error;
          emitRecommendationChanged(latestRecommendationRun);
          return {
            executed: true,
            closed: false,
            error: closeout.error,
            recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
          };
        }

        await applyAndPersistAppendRequest(
          closeout.appendRequest,
          { currentWorkStage: "closed" },
        );
        latestRecommendationRun.taskCloseout = closeout;
        latestRecommendationRun.taskCloseoutError = null;
        emitRecommendationChanged(latestRecommendationRun);

        return {
          executed: true,
          closed: true,
          error: null,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      const planning = planAutoMerge({
        taskContextPackage: {
          ...taskContextPackage,
          currentWorkStage: "auto-merge",
        },
        repositoryDir,
      });
      if (!planning.appendRequest) {
        latestRecommendationRun.autoMergePlanningError = planning.error;
        emitRecommendationChanged(latestRecommendationRun);
        return {
          executed: false,
          closed: false,
          error: planning.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }
      await applyAndPersistAppendRequest(
        planning.appendRequest,
        {
          currentWorkStage: planning.appendRequest.artifactType === "autoMergePlan"
            ? "auto-merge-execution"
            : "auto-merge",
        },
      );
      latestRecommendationRun.autoMergePlanning = planning;
      latestRecommendationRun.autoMergePlanningError = null;
      if (planning.appendRequest.artifactType !== "autoMergePlan") {
        emitRecommendationChanged(latestRecommendationRun);
        return {
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
          executed: false,
          closed: false,
          error: execution.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      await applyAndPersistAppendRequest(
        execution.appendRequest,
        {
          currentWorkStage: execution.appendRequest.artifactType === "autoMergeResult"
            ? "merged"
            : "auto-merge-execution",
        },
      );
      latestRecommendationRun.autoMergeExecution = execution;
      latestRecommendationRun.autoMergeExecutionError = null;
      if (execution.appendRequest.artifactType !== "autoMergeResult") {
        emitRecommendationChanged(latestRecommendationRun);
        return {
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
          executed: true,
          closed: false,
          error: closeout.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      await applyAndPersistAppendRequest(
        closeout.appendRequest,
        { currentWorkStage: "closed" },
      );
      latestRecommendationRun.taskCloseout = closeout;
      latestRecommendationRun.taskCloseoutError = null;
      emitRecommendationChanged(latestRecommendationRun);

      return {
        executed: true,
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
