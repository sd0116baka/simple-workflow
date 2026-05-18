import { watch } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  evaluateExecutionAdmission,
  evaluateStartupCheck,
  runtimeSnapshotFromRepositoryStatus,
} from "./execution-admission.js";
import { getRepositoryStatus as readRepositoryStatus } from "./repository-status.js";
import { parseRecommendationIntent } from "./recommendation-intent.js";
import { buildRecommendationPrompt } from "./recommendation-prompt.js";
import { OPENCODE_RECOMMENDATION_ARGS, runOpencodeRecommendation } from "./recommendation-runner.js";
import { buildTaskContextPackage } from "./task-context-package.js";
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
            ? {
                ...run.executionIntent,
                recommendedTask: { ...run.executionIntent.recommendedTask },
                rationale: [...run.executionIntent.rationale],
                repoStatus: {
                  ...run.executionIntent.repoStatus,
                  changedFiles: [...run.executionIntent.repoStatus.changedFiles],
                },
                observedTasks: run.executionIntent.observedTasks.map((task) => ({ ...task })),
              }
            : null,
          executionAdmission: run.executionAdmission
            ? JSON.parse(JSON.stringify(run.executionAdmission))
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
      const failed = result.error || result.exitCode !== 0;
      const parsed = failed
        ? { intent: null, error: null }
        : parseRecommendationIntent(result.stdout ?? "");
      const taskPool = failed ? null : await buildTaskPool(await listRawTasks(tasksDir));
      const startupCheck = failed || !parsed.intent ? null : await getStartupCheck();
      const intentPackage = failed || !parsed.intent
        ? null
        : buildTaskContextPackage({
            taskPool,
            executionIntent: parsed.intent,
          });
      const admission = failed || !parsed.intent
        ? null
        : evaluateExecutionAdmission({
            taskContextPackage: intentPackage,
            candidateTasks: taskPool.views.candidateTasks,
            runtimeSnapshot: startupCheck.runtimeSnapshot,
            projectProfile: {
              defaults: {
                maxIterations: 3,
              },
            },
          });
      const taskContextPackage = failed || !parsed.intent
        ? null
        : buildTaskContextPackage({
            taskPool,
            executionIntent: parsed.intent,
            appendRequest: admission.appendRequest,
          });
      Object.assign(run, {
        status: failed ? "failed" : "succeeded",
        finishedAt: new Date().toISOString(),
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        exitCode: result.exitCode ?? null,
        error: result.error ?? null,
        executionIntent: parsed.intent,
        executionIntentError: parsed.error,
        executionAdmission: admission,
        taskContextPackage,
      });
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
      const taskPool = await this.listTaskPool();
      const startupCheck = await getStartupCheck();
      if (!startupCheck.canStartWork) {
        const run = {
          id: `recommendation-run-${(recommendationRunSequence += 1)}`,
          status: "blocked",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          command: null,
          args: [],
          startupCheck,
          progress: [],
          executionIntent: null,
          executionIntentError: null,
          executionAdmission: null,
          taskContextPackage: null,
          stdout: "",
          stderr: "",
          exitCode: null,
          error: "启动检查未通过，任务推荐器未运行。",
        };
        latestRecommendationRun = run;
        emitRecommendationChanged(run);
        return toRecommendationSnapshot(run);
      }

      const basePrompt = await readFile(recommendationPromptPath, "utf8");
      const prompt = buildRecommendationPrompt({
        basePrompt,
        candidateTasks: taskPool.views.candidateTasks,
        startupCheck,
      });
      const run = {
        id: `recommendation-run-${(recommendationRunSequence += 1)}`,
        status: "running",
        startedAt: new Date().toISOString(),
        finishedAt: null,
        command: "opencode",
        args: OPENCODE_RECOMMENDATION_ARGS,
        startupCheck,
        progress: [],
        executionIntent: null,
        executionIntentError: null,
        executionAdmission: null,
        taskContextPackage: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        error: null,
      };
      latestRecommendationRun = run;
      emitRecommendationChanged(run);
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
          prompt,
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
