import { test } from "node:test";
import assert from "node:assert/strict";
import { createManualWorkflowActionService } from "../src/workflow/manual-workflow-action-service.js";

function packageFixture(overrides = {}) {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "human-decision",
    taskDraft: { id: "task-001", name: "测试任务" },
    artifacts: {},
    agentRuns: [],
    timeline: [],
    ...overrides,
  };
}

function createLifecycle(initialRun = null) {
  let latestRun = initialRun;
  const setCalls = [];
  return {
    setCalls,
    getLatestRecommendationRun() {
      return latestRun;
    },
    setLatestRecommendationRun(run) {
      latestRun = run;
      setCalls.push(run);
    },
  };
}

function createService(overrides = {}) {
  const recommendationRunLifecycle = overrides.recommendationRunLifecycle ?? createLifecycle();
  const emitted = [];
  return {
    emitted,
    recommendationRunLifecycle,
    service: createManualWorkflowActionService({
      repositoryDir: process.cwd(),
      runExecutionAgentSession: async () => {
        throw new Error("runExecutionAgentSession should not be called");
      },
      runReviewAgentSession: async () => {
        throw new Error("runReviewAgentSession should not be called");
      },
      runConvergenceSession: async () => {
        throw new Error("runConvergenceSession should not be called");
      },
      recommendationRunLifecycle,
      findAcceptableTaskContextPackage: async () => null,
      findAutoMergePlannablePackage: async () => null,
      findGuidableConvergenceDecisionPackage: async () => null,
      findCancellableHumanDecisionPackage: async () => null,
      applyAppendRequest: async () => {
        throw new Error("applyAppendRequest should not be called");
      },
      emitRecommendationChanged: (run) => {
        emitted.push(run);
      },
      acceptConvergenceAction: async () => {
        throw new Error("acceptConvergenceAction should not be called");
      },
      replanAutoMergeAction: async () => {
        throw new Error("replanAutoMergeAction should not be called");
      },
      continueConvergenceAction: async () => {
        throw new Error("continueConvergenceAction should not be called");
      },
      cancelTaskAction: async () => {
        throw new Error("cancelTaskAction should not be called");
      },
      ...overrides,
    }),
  };
}

test("manual workflow action service returns a scoped missing package response", async () => {
  const { service, emitted } = createService();

  const result = await service.acceptConvergenceSuccess({
    packageId: "task-context-package:missing.yaml",
  });

  assert.equal(result.accepted, false);
  assert.match(result.error, /task-context-package:missing\.yaml/);
  assert.equal(result.recommendationRun, null);
  assert.deepEqual(emitted, []);
});

test("manual workflow action service rejects replanning packages that already closed out", async () => {
  let actionCalled = false;
  const taskContextPackage = packageFixture({
    currentWorkStage: "closed",
    artifacts: {
      humanDecision: {
        body: { decision: "accept-convergence" },
      },
      taskCloseout: {
        body: { status: "closed" },
      },
    },
  });
  const { service, emitted } = createService({
    findAutoMergePlannablePackage: async () => taskContextPackage,
    replanAutoMergeAction: async () => {
      actionCalled = true;
      return { shouldEmit: true, response: { planned: true, error: null } };
    },
  });

  const result = await service.replanAutoMerge();

  assert.equal(result.planned, false);
  assert.match(result.error, /没有可重新生成合并计划/);
  assert.equal(result.recommendationRun, null);
  assert.equal(actionCalled, false);
  assert.deepEqual(emitted, []);
});

test("manual workflow action service ignores malformed closeout arrays when replanning", async () => {
  let actionCalled = false;
  const taskContextPackage = packageFixture({
    artifacts: {
      humanDecision: {
        body: { decision: "accept-convergence" },
      },
      taskCloseout: [
        {
          body: { status: "closed" },
        },
      ],
    },
  });
  const { service } = createService({
    findAutoMergePlannablePackage: async () => taskContextPackage,
    replanAutoMergeAction: async () => {
      actionCalled = true;
      return { shouldEmit: false, response: { planned: true, error: null } };
    },
  });

  const result = await service.replanAutoMerge();

  assert.equal(result.planned, true);
  assert.equal(result.error, null);
  assert.equal(actionCalled, true);
});

test("manual workflow action service attaches a manual run before invoking an action", async () => {
  const taskContextPackage = packageFixture();
  let actionArgs = null;
  const runExecutionAgentSession = async () => ({ sessionId: "session:execution" });
  const runReviewAgentSession = async () => ({ sessionId: "session:review" });
  const runConvergenceSession = async () => ({ sessionId: "session:convergence" });
  const { service, recommendationRunLifecycle, emitted } = createService({
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    findGuidableConvergenceDecisionPackage: async (packageId) => {
      assert.equal(packageId, taskContextPackage.packageId);
      return taskContextPackage;
    },
    continueConvergenceAction: async (args) => {
      actionArgs = args;
      args.recommendationRun.taskContextPackage = {
        ...args.recommendationRun.taskContextPackage,
        currentWorkStage: "execution-agent",
      };
      return {
        shouldEmit: true,
        response: { continued: true, error: null },
      };
    },
  });

  const result = await service.continueConvergenceWithGuidance({
    packageId: taskContextPackage.packageId,
    guidance: "请继续收敛",
    focusAreas: ["测试"],
    avoidRepeating: ["重复修改"],
    expectedNextOutcome: "通过验收",
  });

  assert.equal(result.continued, true);
  assert.equal(result.error, null);
  assert.equal(result.recommendationRun.id, "manual-workflow-action");
  assert.equal(result.recommendationRun.taskContextPackage.currentWorkStage, "execution-agent");
  assert.equal(recommendationRunLifecycle.setCalls.length, 1);
  assert.equal(emitted.length, 1);
  assert.equal(actionArgs.guidance, "请继续收敛");
  assert.deepEqual(actionArgs.focusAreas, ["测试"]);
  assert.deepEqual(actionArgs.avoidRepeating, ["重复修改"]);
  assert.equal(actionArgs.expectedNextOutcome, "通过验收");
  assert.equal(actionArgs.taskContextPackage, taskContextPackage);
  assert.equal(actionArgs.recommendationRun.id, "manual-workflow-action");
  assert.equal(actionArgs.runExecutionAgentSession, runExecutionAgentSession);
  assert.equal(actionArgs.runReviewAgentSession, runReviewAgentSession);
  assert.equal(actionArgs.runConvergenceSession, runConvergenceSession);
});
