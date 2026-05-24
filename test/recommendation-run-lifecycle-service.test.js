import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkflowService } from "../src/workflow/workflow-service.js";
import {
  createGitRepository,
  writePrompt,
  writeValidTasksDir,
} from "./support/recommendation-service-fixtures.js";

async function createProgressLogDir(t) {
  const dir = await mkdtemp(join(tmpdir(), "simple-workflow-service-progress-log-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("workflow service keeps successful runs when recommendation intent parsing fails", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-parse-failure");
  const tasksDir = await writeValidTasksDir("recommendation-parse-failure");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => ({
      stdout: "不是 JSON",
      stderr: "",
      exitCode: 0,
      error: null,
    }),
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "succeeded") {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(finished.status, "succeeded");
  assert.equal(finished.executionIntent, null);
  assert.match(finished.executionIntentError, /Unexpected token|JSON/);
});

test("workflow service emits running progress for recommendation runs", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-progress");
  const tasksDir = await writeValidTasksDir("recommendation-progress");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async ({ onProgress }) => {
      onProgress({ type: "step_start", message: "开始运行 opencode" });
      return {
        stdout: "建议先做 task-001",
        stderr: "",
        exitCode: 0,
        error: null,
      };
    },
  });

  const progressEvent = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.progress.length > 0) {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const running = await progressEvent;

  assert.equal(running.status, "running");
  assert.equal(running.progress[0].message, "开始运行 opencode");
});

test("workflow service persists complete recommendation run progress logs", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-progress-log");
  const tasksDir = await writeValidTasksDir("recommendation-progress-log");
  const recommendationRunProgressLogDir = await createProgressLogDir(t);
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    recommendationRunProgressLogDir,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async ({ onProgress }) => {
      for (let index = 1; index <= 205; index += 1) {
        onProgress({ type: "stdout", message: `line-${index}` });
      }
      return {
        stdout: "不是 JSON",
        stderr: "",
        exitCode: 0,
        error: null,
      };
    },
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "succeeded") {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const finished = await completed;
  const progressLog = service.readRecommendationRunProgressLog(finished.id);
  const stdoutEvents = progressLog.events.filter((event) => event.type === "stdout");

  assert.equal(finished.progress.length, 200);
  assert.equal(finished.progress[0].message, "line-6");
  assert.equal(progressLog.runId, finished.id);
  assert.equal(stdoutEvents.length, 205);
  assert.equal(stdoutEvents[0].message, "line-1");
  assert.equal(progressLog.events.some((event) => event.type === "run_started"), true);
  assert.equal(progressLog.events.some((event) => event.type === "run_finished"), true);
});

test("workflow service cancels a running recommendation run", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-cancel");
  const tasksDir = await writeValidTasksDir("recommendation-cancel");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: ({ signal, onProgress }) => new Promise((resolve) => {
      signal.addEventListener("abort", () => {
        onProgress({
          type: "process_cancelled",
          stream: "system",
          message: "用户取消运行",
          terminalLine: "process: cancelled by user",
        });
        resolve({
          stdout: "",
          stderr: "",
          exitCode: null,
          error: "cancelled",
        });
      }, { once: true });
    }),
  });

  await service.createRecommendationRun();
  const result = service.cancelRecommendationRun();
  await new Promise((resolve) => setImmediate(resolve));
  const latest = service.getLatestRecommendationRun();

  assert.equal(result.cancelled, true);
  assert.equal(latest.status, "cancelled");
  assert.equal(latest.error, "cancelled");
  assert.equal(latest.progress.some((entry) => entry.type === "cancel_requested"), true);
  assert.equal(latest.progress.some((entry) => entry.type === "process_cancelled"), true);
});

test("workflow service does not start a second recommendation run while one is running", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-mutual-exclusion");
  const tasksDir = await writeValidTasksDir("recommendation-mutual-exclusion");
  let commandRuns = 0;
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: ({ signal }) => new Promise((resolve) => {
      commandRuns += 1;
      const resolveCancelled = () => {
        resolve({
          stdout: "",
          stderr: "",
          exitCode: null,
          error: "cancelled",
        });
      };
      if (signal.aborted) {
        resolveCancelled();
        return;
      }
      signal.addEventListener("abort", () => {
        resolveCancelled();
      }, { once: true });
    }),
  });

  const first = await service.createRecommendationRun();
  const second = await service.createRecommendationRun();
  service.cancelRecommendationRun();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(first.status, "running");
  assert.equal(second.status, "running");
  assert.equal(second.id, first.id);
  assert.equal(commandRuns, 1);
});

test("workflow service marks non-zero recommendation exits as failed", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-failure");
  const tasksDir = await writeValidTasksDir("recommendation-failure");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => ({
      stdout: "",
      stderr: "模型调用失败",
      exitCode: 2,
      error: null,
    }),
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "failed") {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(finished.status, "failed");
  assert.equal(finished.stderr, "模型调用失败");
  assert.equal(finished.exitCode, 2);
});

test("workflow service marks thrown recommendation commands as failed", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-throw");
  const tasksDir = await writeValidTasksDir("recommendation-throw");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: () => {
      throw new Error("命令启动失败");
    },
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "failed") {
        resolve(event.run);
      }
    });
  });

  const running = await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(running.status, "running");
  assert.equal(finished.status, "failed");
  assert.equal(finished.error, "命令启动失败");
});
