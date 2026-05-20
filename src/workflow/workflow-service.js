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
import {
  runExecutionAgent,
  runOpencodeExecutionAgentSession,
} from "./execution-agent-flow.js";
import { executeAutoMerge, planAutoMerge } from "./auto-merge-flow.js";
import {
  acceptConvergenceSuccess,
  cancelTaskAfterConvergenceFailure,
  provideHumanConvergenceGuidance,
  requestHumanDecisionForConvergenceFailure,
  requestHumanDecisionForConvergenceSuccess,
} from "./human-decision-flow.js";
import { runOpencodeRecommendation } from "./recommendation-runner.js";
import { closeTask } from "./task-closeout-flow.js";
import { runConvergence } from "./convergence-flow.js";
import { runReviewAgent } from "./review-agent-flow.js";
import {
  loadTaskContextPackages,
  saveTaskContextPackage,
} from "./task-context-package-store.js";
import { applyAppendRequest, buildTaskPool } from "./task-pool.js";
import { listRawTasks } from "./task-source.js";
import {
  cleanupTestStateFixtures,
  seedTestStateFixtures,
} from "./state-fixtures.js";

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
  runRecommendationCommand = ({ prompt, onProgress, signal }) =>
    runOpencodeRecommendation({
      prompt,
      cwd: repositoryDir,
      onProgress,
      signal,
    }),
  runExecutionAgentSession = runOpencodeExecutionAgentSession,
  watchDebounceMs = 100,
}) {
  const listeners = new Set();
  let watcher = null;
  let debounceTimer = null;
  let latestRecommendationRun = null;
  let recommendationRunSequence = 0;
  const recommendationRunControllers = new Map();

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
          successHumanDecisionRequest: run.successHumanDecisionRequest
            ? JSON.parse(JSON.stringify(run.successHumanDecisionRequest))
            : null,
          successHumanDecisionError: run.successHumanDecisionError ?? null,
          failureHumanDecisionRequest: run.failureHumanDecisionRequest
            ? JSON.parse(JSON.stringify(run.failureHumanDecisionRequest))
            : null,
          failureHumanDecisionError: run.failureHumanDecisionError ?? null,
          humanConvergenceGuidance: run.humanConvergenceGuidance
            ? JSON.parse(JSON.stringify(run.humanConvergenceGuidance))
            : null,
          humanConvergenceGuidanceError: run.humanConvergenceGuidanceError ?? null,
          taskCancellation: run.taskCancellation
            ? JSON.parse(JSON.stringify(run.taskCancellation))
            : null,
          taskCancellationError: run.taskCancellationError ?? null,
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
    const taskPool = buildTaskPool(await listRawTasks(tasksDir), {
      taskContextPackages: await loadExistingTaskContextPackages(),
    });
    const activeWork = findActiveWork(taskPool.taskContextPackages);
    return evaluateStartupCheck({
      runtimeSnapshot: {
        ...runtimeSnapshotFromRepositoryStatus(await getRepositoryStatus()),
        activeWork,
      },
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

  function findActiveWork(taskContextPackages) {
    const activePackage = taskContextPackages.find((taskContextPackage) =>
      taskContextPackage.currentWorkStage !== "task-pool"
        && taskContextPackage.currentWorkStage !== "closed"
        && taskContextPackage.currentWorkStage !== "cancelled",
    );
    if (!activePackage) return null;
    return {
      packageId: activePackage.packageId,
      currentWorkStage: activePackage.currentWorkStage,
      taskName: activePackage.taskDraft?.name ?? null,
      sourcePath: activePackage.source?.path ?? null,
    };
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

  async function findAutoMergePlannablePackage(packageId) {
    const taskContextPackages = await loadExistingTaskContextPackages();
    if (packageId) {
      return taskContextPackages.find((candidate) => candidate.packageId === packageId) ?? null;
    }
    return taskContextPackages.find((candidate) =>
      candidate.artifacts?.humanDecision?.body?.decision === "accept-completion"
        && !candidate.artifacts?.taskCloseout?.body,
    ) ?? null;
  }

  function latestMultiArtifact(taskContextPackage, artifactType) {
    const artifacts = taskContextPackage?.artifacts?.[artifactType];
    return Array.isArray(artifacts) && artifacts.length > 0
      ? artifacts[artifacts.length - 1]
      : null;
  }

  async function findConvergenceFailureDecisionPackage(packageId) {
    const taskContextPackages = await loadExistingTaskContextPackages();
    const matchesConvergenceFailureDecision = (candidate) => {
      const convergenceFailure = latestMultiArtifact(candidate, "convergenceFailure");
      return candidate.currentWorkStage === "human-decision"
        && convergenceFailure?.artifactId
        && candidate.artifacts?.humanDecisionRequest?.body?.targetRef === convergenceFailure.artifactId
        && !candidate.artifacts?.humanDecision?.body;
    };
    if (packageId) {
      const candidate = taskContextPackages.find((item) => item.packageId === packageId) ?? null;
      return candidate && matchesConvergenceFailureDecision(candidate) ? candidate : null;
    }
    if (
      latestRecommendationRun?.taskContextPackage
      && matchesConvergenceFailureDecision(latestRecommendationRun.taskContextPackage)
    ) {
      return latestRecommendationRun.taskContextPackage;
    }
    return taskContextPackages.find(matchesConvergenceFailureDecision) ?? null;
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
        executionAgentRuns: [],
        executionAgentErrors: [],
        reviewAgentRuns: [],
        reviewAgentErrors: [],
        convergenceRuns: [],
        convergenceErrors: [],
      };
    }
    latestRecommendationRun.executionAgentRuns ??= [];
    latestRecommendationRun.executionAgentErrors ??= [];
    latestRecommendationRun.reviewAgentRuns ??= [];
    latestRecommendationRun.reviewAgentErrors ??= [];
    latestRecommendationRun.convergenceRuns ??= [];
    latestRecommendationRun.convergenceErrors ??= [];
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

  async function finishRecommendationRun(run, startedCommand, onProgress) {
    try {
      const result = await startedCommand;
      if (run.status === "cancelled") return;
      const completedRun = await completeRecommendationFlow({
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
        onProgress,
        signal: recommendationRunControllers.get(run.id)?.signal,
      });
      if (run.status === "cancelled") return;
      Object.assign(run, completedRun);
      await persistTaskContextPackage(run.taskContextPackage);
    } catch (error) {
      if (run.status === "cancelled") return;
      Object.assign(run, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error.message,
      });
    } finally {
      recommendationRunControllers.delete(run.id);
    }
    emitRecommendationChanged(run);
  }

  async function runGuidedCorrectionRound({ maxIterations = 3 } = {}) {
    const execution = await runExecutionAgent({
      taskContextPackage: latestRecommendationRun.taskContextPackage,
      runAgentSession: runExecutionAgentSession,
      repositoryDir,
    });
    if (!execution.appendRequest) return { execution, review: null, convergence: null };
    await applyAndPersistAppendRequest(execution.appendRequest, {
      currentWorkStage: "execution-agent",
    });
    latestRecommendationRun.executionAgentRuns.push(execution);
    latestRecommendationRun.executionAgentErrors = [
      ...latestRecommendationRun.executionAgentErrors,
      execution.error,
    ].filter(Boolean);
    if (execution.error) return { execution, review: null, convergence: null };

    const review = runReviewAgent({
      taskContextPackage: latestRecommendationRun.taskContextPackage,
    });
    if (!review.appendRequest) return { execution, review, convergence: null };
    await applyAndPersistAppendRequest(review.appendRequest, {
      currentWorkStage: "review-agent",
    });
    latestRecommendationRun.reviewAgentRuns.push(review);
    latestRecommendationRun.reviewAgentErrors = [
      ...latestRecommendationRun.reviewAgentErrors,
      review.error,
    ].filter(Boolean);

    const convergence = runConvergence({
      taskContextPackage: latestRecommendationRun.taskContextPackage,
      maxIterations,
    });
    if (!convergence.appendRequest) return { execution, review, convergence };
    await applyAndPersistAppendRequest(convergence.appendRequest, {
      currentWorkStage: "convergence",
    });
    latestRecommendationRun.convergenceRuns.push(convergence);
    latestRecommendationRun.convergenceErrors = [
      ...latestRecommendationRun.convergenceErrors,
      convergence.error,
    ].filter(Boolean);

    if (convergence.appendRequest.artifactType === "convergenceSuccess") {
      const request = requestHumanDecisionForConvergenceSuccess({
        taskContextPackage: latestRecommendationRun.taskContextPackage,
      });
      latestRecommendationRun.successHumanDecisionRequest = request;
      latestRecommendationRun.successHumanDecisionError = request.error ?? null;
      if (request.appendRequest) {
        await applyAndPersistAppendRequest(request.appendRequest, {
          currentWorkStage: "human-decision",
        });
      }
    }
    if (convergence.appendRequest.artifactType === "convergenceFailure") {
      const request = requestHumanDecisionForConvergenceFailure({
        taskContextPackage: latestRecommendationRun.taskContextPackage,
      });
      latestRecommendationRun.failureHumanDecisionRequest = request;
      latestRecommendationRun.failureHumanDecisionError = request.error ?? null;
      if (request.appendRequest) {
        await applyAndPersistAppendRequest(request.appendRequest, {
          currentWorkStage: "human-decision",
        });
      }
    }

    return { execution, review, convergence };
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

    async seedTestStateFixtures({ fixtureKey = "task-pool" } = {}) {
      const result = await seedTestStateFixtures({
        repositoryDir,
        tasksDir,
        storeDir: taskContextPackageStoreDir,
        fixtureKey,
      });
      latestRecommendationRun = null;
      emit({
        type: "tasks-changed",
        eventType: "seed-test-state-fixtures",
        fileName: "stub-state-fixtures",
        timestamp: new Date().toISOString(),
      });
      return result;
    },

    async cleanupTestStateFixtures() {
      const result = await cleanupTestStateFixtures({
        repositoryDir,
        tasksDir,
        storeDir: taskContextPackageStoreDir,
      });
      latestRecommendationRun = null;
      emit({
        type: "tasks-changed",
        eventType: "cleanup-test-state-fixtures",
        fileName: "stub-state-fixtures",
        timestamp: new Date().toISOString(),
      });
      return result;
    },

    async createRecommendationRun() {
      if (latestRecommendationRun?.status === "running") {
        return toRecommendationSnapshot(latestRecommendationRun);
      }
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
        run.progress = run.progress.slice(-200);
        emitRecommendationChanged(run);
      };
      const controller = new AbortController();
      recommendationRunControllers.set(run.id, controller);
      const startedCommand = Promise.resolve().then(() =>
        runRecommendationCommand({
          prompt: run.prompt,
          run: toRecommendationSnapshot(run),
          onProgress: appendProgress,
          signal: controller.signal,
        }),
      );
      finishRecommendationRun(run, startedCommand, appendProgress);
      return toRecommendationSnapshot(run);
    },

    cancelRecommendationRun() {
      const run = latestRecommendationRun;
      if (!run || run.status !== "running") {
        return {
          cancelled: false,
          error: "没有正在运行的推荐器流程。",
          recommendationRun: toRecommendationSnapshot(run),
        };
      }
      run.status = "cancelled";
      run.finishedAt = new Date().toISOString();
      run.error = "cancelled";
      run.progress.push({
        type: "cancel_requested",
        stream: "system",
        message: "用户请求取消运行",
        terminalLine: "process: cancellation requested by user",
        timestamp: new Date().toISOString(),
      });
      run.progress = run.progress.slice(-200);
      recommendationRunControllers.get(run.id)?.abort();
      emitRecommendationChanged(run);
      return {
        cancelled: true,
        error: null,
        recommendationRun: toRecommendationSnapshot(run),
      };
    },

    getLatestRecommendationRun() {
      return toRecommendationSnapshot(latestRecommendationRun);
    },

    async acceptConvergenceSuccess({ packageId = null } = {}) {
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

      const decision = acceptConvergenceSuccess({
        taskContextPackage,
        repositoryDir,
      });
      if (!decision.appendRequest) {
        latestRecommendationRun.successHumanDecisionError = decision.error;
        emitRecommendationChanged(latestRecommendationRun);
        return {
          accepted: false,
          error: decision.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      let taskPool = await applyAndPersistAppendRequest(
        decision.appendRequest,
        { currentWorkStage: "auto-merge-planning" },
      );
      latestRecommendationRun.successHumanDecisionError = null;

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
            : "auto-merge-planning",
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

    async replanAutoMerge({ packageId = null } = {}) {
      const taskContextPackage = await findAutoMergePlannablePackage(packageId);
      if (!taskContextPackage || taskContextPackage.artifacts?.taskCloseout?.body) {
        return {
          planned: false,
          error: packageId
            ? `没有找到可重新生成合并计划的任务上下文包：${packageId}`
            : "没有可重新生成合并计划的任务上下文包。",
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      ensureLatestRecommendationRun(taskContextPackage);
      const planning = planAutoMerge({
        taskContextPackage: {
          ...latestRecommendationRun.taskContextPackage,
          currentWorkStage: "auto-merge-planning",
        },
        repositoryDir,
      });
      if (!planning.appendRequest) {
        latestRecommendationRun.autoMergePlanningError = planning.error;
        emitRecommendationChanged(latestRecommendationRun);
        return {
          planned: false,
          error: planning.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      await applyAndPersistAppendRequest(
        planning.appendRequest,
        {
          currentWorkStage: planning.appendRequest.artifactType === "autoMergePlan"
            ? "auto-merge-execution"
            : "auto-merge-planning",
        },
      );
      latestRecommendationRun.autoMergePlanning = planning;
      latestRecommendationRun.autoMergePlanningError = null;
      latestRecommendationRun.taskCloseoutError = null;
      emitRecommendationChanged(latestRecommendationRun);

      return {
        planned: planning.appendRequest.artifactType === "autoMergePlan",
        error: null,
        recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
      };
    },

    async retryWithConvergenceGuidance({
      packageId = null,
      guidance = "",
      focusAreas = [],
      avoidRepeating = [],
      expectedNextOutcome = "",
    } = {}) {
      const taskContextPackage = await findConvergenceFailureDecisionPackage(packageId);
      if (!taskContextPackage) {
        return {
          retried: false,
          error: packageId
            ? `没有找到可带意见重试的任务上下文包：${packageId}`
            : "没有可带意见重试的任务上下文包。",
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      ensureLatestRecommendationRun(taskContextPackage);
      const guidanceResult = provideHumanConvergenceGuidance({
        taskContextPackage,
        guidance,
        focusAreas,
        avoidRepeating,
        expectedNextOutcome,
      });
      if (!guidanceResult.appendRequest) {
        latestRecommendationRun.humanConvergenceGuidanceError = guidanceResult.error;
        emitRecommendationChanged(latestRecommendationRun);
        return {
          retried: false,
          error: guidanceResult.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      await applyAndPersistAppendRequest(guidanceResult.appendRequest, {
        currentWorkStage: "human-guidance",
      });
      latestRecommendationRun.humanConvergenceGuidance = guidanceResult;
      latestRecommendationRun.humanConvergenceGuidanceError = null;

      const round = await runGuidedCorrectionRound();
      const error = round.execution?.error
        ?? round.review?.error
        ?? round.convergence?.error
        ?? null;
      emitRecommendationChanged(latestRecommendationRun);

      return {
        retried: !error,
        error,
        recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
      };
    },

    async cancelTask({ packageId = null } = {}) {
      const taskContextPackage = await findConvergenceFailureDecisionPackage(packageId);
      if (!taskContextPackage) {
        return {
          cancelled: false,
          error: packageId
            ? `没有找到可取消的收敛失败任务上下文包：${packageId}`
            : "没有可取消的收敛失败任务上下文包。",
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      ensureLatestRecommendationRun(taskContextPackage);
      const cancellation = cancelTaskAfterConvergenceFailure({
        taskContextPackage,
        repositoryDir,
      });
      if (!cancellation.appendRequest) {
        latestRecommendationRun.taskCancellationError = cancellation.error;
        emitRecommendationChanged(latestRecommendationRun);
        return {
          cancelled: false,
          error: cancellation.error,
          recommendationRun: toRecommendationSnapshot(latestRecommendationRun),
        };
      }

      await applyAndPersistAppendRequest(cancellation.appendRequest, {
        currentWorkStage: "cancelled",
      });
      latestRecommendationRun.taskCancellation = cancellation;
      latestRecommendationRun.taskCancellationError = null;
      emitRecommendationChanged(latestRecommendationRun);

      return {
        cancelled: true,
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
