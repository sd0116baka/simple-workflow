import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecommendationRunLifecycle } from "../src/workflow/recommendation-run-lifecycle.js";

async function createLifecycle(t, overrides = {}) {
  const {
    promptText = null,
    taskFileContent = null,
    ...lifecycleOverrides
  } = overrides;
  const tasksDir = await mkdtemp(join(tmpdir(), "simple-workflow-lifecycle-tasks-"));
  t.after(() => rm(tasksDir, { recursive: true, force: true }));
  const recommendationPromptPath = join(tasksDir, "recommender.prompt.md");
  if (promptText !== null) {
    await writeFile(recommendationPromptPath, promptText, "utf8");
  }
  if (taskFileContent !== null) {
    await writeFile(join(tasksDir, "task.yaml"), taskFileContent, "utf8");
  }
  const emitted = [];
  let commandStarted = false;
  const lifecycle = createRecommendationRunLifecycle({
    tasksDir,
    repositoryDir: process.cwd(),
    recommendationPromptPath,
    taskContextWorkspace: {
      async loadExistingTaskContextPackages() {
        return [];
      },
    },
    async getStartupCheck() {
      return {
        canStartWork: false,
        findings: [
          {
            field: "worktree",
            severity: "blocking",
            code: "WORKTREE_DIRTY",
            message: "测试阻塞。",
          },
        ],
        runtimeSnapshot: {
          activeWork: null,
          worktree: {
            clean: false,
            changedFiles: ["README.md"],
          },
        },
      };
    },
    async persistTaskContextPackage() {
      throw new Error("blocked runs must not persist task context packages");
    },
    runRecommendationCommand() {
      commandStarted = true;
      throw new Error("blocked runs must not start recommendation commands");
    },
    runExecutionAgentSession() {
      throw new Error("blocked runs must not start execution agent sessions");
    },
    emitRecommendationChanged(run) {
      emitted.push(run);
    },
    ...lifecycleOverrides,
  });
  return {
    lifecycle,
    emitted,
    commandStarted: () => commandStarted,
  };
}

test("recommendation run lifecycle returns a clear cancellation result without a run", async (t) => {
  const { lifecycle } = await createLifecycle(t);

  const result = lifecycle.cancelRecommendationRun();

  assert.equal(result.cancelled, false);
  assert.match(result.error, /没有正在运行/);
  assert.equal(result.recommendationRun, null);
});

test("recommendation run lifecycle keeps blocked startup runs inside the lifecycle", async (t) => {
  const { lifecycle, emitted, commandStarted } = await createLifecycle(t);

  const run = await lifecycle.createRecommendationRun();

  assert.equal(run.status, "blocked");
  assert.equal(run.error, "启动检查未通过，任务推荐器未运行。");
  assert.equal(commandStarted(), false);
  assert.equal(lifecycle.getLatestRecommendationRun().status, "blocked");
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].status, "blocked");
});

test("recommendation run lifecycle aborts running commands through the controller registry", async (t) => {
  const abortedRunIds = [];
  const signalsByRunId = new Map();
  let resolveCommand;
  let commandStarted;
  const commandStartedPromise = new Promise((resolve) => {
    commandStarted = resolve;
  });
  const { lifecycle } = await createLifecycle(t, {
    promptText: "请推荐一个任务。",
    taskFileContent: [
      "id: task-running",
      "title: 可运行任务",
      "type: feature",
      "description: 用于测试 running lifecycle",
      "acceptance:",
      "  - 能启动推荐运行",
      "",
    ].join("\n"),
    async getStartupCheck() {
      return {
        canStartWork: true,
        findings: [],
        runtimeSnapshot: {
          activeWork: null,
          worktree: { clean: true, changedFiles: [] },
        },
      };
    },
    taskContextWorkspace: {
      async loadExistingTaskContextPackages() {
        return [];
      },
    },
    recommendationRunControllerRegistry: {
      create(runId) {
        const signal = { runId };
        signalsByRunId.set(runId, signal);
        return { signal };
      },
      signalFor(runId) {
        return signalsByRunId.get(runId);
      },
      abort(runId) {
        abortedRunIds.push(runId);
        return true;
      },
      delete(runId) {
        signalsByRunId.delete(runId);
        return true;
      },
    },
    runRecommendationCommand: ({ signal }) => new Promise((resolve) => {
      assert.equal(signal, signalsByRunId.get("recommendation-run-1"));
      resolveCommand = resolve;
      commandStarted();
    }),
  });

  const run = await lifecycle.createRecommendationRun();
  await commandStartedPromise;
  const cancellation = lifecycle.cancelRecommendationRun();
  resolveCommand({ stdout: "", stderr: "", exitCode: 0 });

  assert.equal(run.status, "running");
  assert.equal(cancellation.cancelled, true);
  assert.deepEqual(abortedRunIds, ["recommendation-run-1"]);
});
