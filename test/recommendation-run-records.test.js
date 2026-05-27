import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBlockedRecommendationRun,
  createRunningRecommendationRun,
} from "../src/workflow/recommendation-run-records.js";

const startupCheck = {
  canStartWork: true,
  findings: [],
};

test("recommendation run records create blocked runs with empty workflow fields", () => {
  const run = createBlockedRecommendationRun({
    id: "recommendation-run-1",
    startupCheck: {
      ...startupCheck,
      error: "不能启动",
    },
    now: () => "2026-05-21T00:00:00.000Z",
  });

  assert.equal(run.status, "blocked");
  assert.equal(run.startedAt, "2026-05-21T00:00:00.000Z");
  assert.equal(run.finishedAt, "2026-05-21T00:00:00.000Z");
  assert.equal(run.command, null);
  assert.deepEqual(run.args, []);
  assert.deepEqual(run.taskRecommender, {
    status: "blocked",
    startedAt: "2026-05-21T00:00:00.000Z",
    finishedAt: "2026-05-21T00:00:00.000Z",
    selectedPackageId: null,
    outputRef: null,
    error: "不能启动",
  });
  assert.deepEqual(run.executionAgentRuns, []);
  assert.deepEqual(run.reviewAgentRuns, []);
  assert.deepEqual(run.convergenceRuns, []);
  assert.equal(run.taskContextPackage, null);
  assert.equal(run.error, "不能启动");
});

test("recommendation run records create running runs with prompt candidate view", () => {
  const run = createRunningRecommendationRun({
    id: "recommendation-run-1",
    basePrompt: "推荐任务。",
    taskPool: {
      views: {
        candidateTasks: [
          {
            packageId: "task-context-package:tasks/task-001.yaml",
            taskDraft: { id: "task-001", name: "测试任务" },
          },
        ],
      },
    },
    startupCheck,
    now: () => "2026-05-21T00:00:00.000Z",
  });

  assert.equal(run.status, "running");
  assert.equal(run.command, "opencode");
  assert.deepEqual(run.args, ["run", "--format", "json"]);
  assert.equal(run.finishedAt, null);
  assert.deepEqual(run.taskRecommender, {
    status: "running",
    startedAt: "2026-05-21T00:00:00.000Z",
    finishedAt: null,
    selectedPackageId: null,
    outputRef: null,
    error: null,
  });
  assert.match(run.prompt, /candidateTasks/);
  assert.match(run.prompt, /task-context-package:tasks\/task-001.yaml/);
  assert.equal(run.error, null);
});
