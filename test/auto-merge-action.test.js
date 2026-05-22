import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptConvergenceAndRunAutoMerge,
  replanAcceptedAutoMerge,
} from "../src/workflow/auto-merge-action.js";

function packageFixture(overrides = {}) {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "task-pool",
    taskDraft: { id: "task-001", name: "测试任务" },
    artifacts: {},
    agentRuns: [],
    timeline: [],
    ...overrides,
  };
}

function createAppendRecorder(recommendationRun) {
  const calls = [];
  return {
    calls,
    applyAppendRequest: async (appendRequest, { currentWorkStage }) => {
      calls.push({ appendRequest, currentWorkStage });
      recommendationRun.taskContextPackage = {
        ...recommendationRun.taskContextPackage,
        currentWorkStage,
        artifacts: {
          ...recommendationRun.taskContextPackage.artifacts,
          [appendRequest.artifactType]: {
            artifactId: appendRequest.artifactType,
            body: appendRequest.artifact,
            appendedAt: appendRequest.artifact.appendedAt ?? "2026-05-21T00:00:00.000Z",
          },
        },
      };
    },
  };
}

test("auto-merge action records acceptance failure on the recommendation run", async () => {
  const taskContextPackage = packageFixture();
  const recommendationRun = { taskContextPackage };
  const { applyAppendRequest, calls } = createAppendRecorder(recommendationRun);

  const result = await acceptConvergenceAndRunAutoMerge({
    taskContextPackage,
    recommendationRun,
    repositoryDir: process.cwd(),
    applyAppendRequest,
  });

  assert.equal(result.shouldEmit, true);
  assert.equal(result.response.accepted, false);
  assert.match(result.response.error, /human-decision/);
  assert.equal(recommendationRun.successHumanDecisionError, result.response.error);
  assert.deepEqual(calls, []);
});

test("auto-merge replan action routes planning rejection back to human decision", async () => {
  const recommendationRun = {
    taskContextPackage: packageFixture({
      currentWorkStage: "merged",
      artifacts: {
        humanDecision: {
          artifactId: "humanDecision",
          body: { decision: "accept-convergence" },
        },
      },
    }),
    taskCloseoutError: "previous stale plan failed",
  };
  const { applyAppendRequest, calls } = createAppendRecorder(recommendationRun);

  const result = await replanAcceptedAutoMerge({
    recommendationRun,
    repositoryDir: process.cwd(),
    applyAppendRequest,
  });

  assert.equal(result.shouldEmit, true);
  assert.deepEqual(result.response, { planned: false, error: null });
  assert.deepEqual(
    calls.map((call) => [call.appendRequest.artifactType, call.currentWorkStage]),
    [
      ["autoMergeRejection", "auto-merge-planning"],
      ["humanDecisionRequest", "human-decision"],
    ],
  );
  assert.equal(recommendationRun.autoMergePlanning.appendRequest.artifactType, "autoMergeRejection");
  assert.equal(recommendationRun.autoMergePlanningError, null);
  assert.equal(recommendationRun.taskCloseoutError, null);
  assert.equal(
    recommendationRun.autoMergeHumanDecisionRequest.appendRequest.artifact.targetType,
    "autoMergeRejection",
  );
});
