import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createManualWorkflowActionProtocol,
  latestRecommendationSnapshot,
  missingManualWorkflowActionResponse,
} from "../src/workflow/manual-workflow-action-protocol.js";

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

function recommendationRun(overrides = {}) {
  return {
    id: "running",
    status: "completed",
    args: [],
    progress: [],
    startupCheck: null,
    taskContextPackage: packageFixture(),
    ...overrides,
  };
}

test("manual workflow action protocol returns missing target responses with snapshots", () => {
  const lifecycle = createLifecycle(recommendationRun());

  const result = missingManualWorkflowActionResponse({
    response: { accepted: false },
    packageId: "task-context-package:missing.yaml",
    missingPackageMessage: (id) => `missing ${id}`,
    missingDefaultMessage: "missing default",
    recommendationRunLifecycle: lifecycle,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.error, "missing task-context-package:missing.yaml");
  assert.equal(result.recommendationRun.id, "running");
  assert.notEqual(result.recommendationRun, lifecycle.getLatestRecommendationRun());
});

test("manual workflow action protocol exposes the latest recommendation snapshot", () => {
  const latestRun = recommendationRun({
    id: "manual-workflow-action",
    status: "running",
  });
  const lifecycle = createLifecycle(latestRun);

  const snapshot = latestRecommendationSnapshot(lifecycle);

  assert.equal(snapshot.id, "manual-workflow-action");
  assert.notEqual(snapshot, latestRun);
});

test("manual workflow action protocol attaches a manual run, emits, and snapshots result", async () => {
  const taskContextPackage = packageFixture();
  const lifecycle = createLifecycle(null);
  const emitted = [];
  const protocol = createManualWorkflowActionProtocol({
    recommendationRunLifecycle: lifecycle,
    emitRecommendationChanged: (run) => emitted.push(run),
  });

  const result = await protocol.runManualWorkflowAction({
    packageId: taskContextPackage.packageId,
    findTaskContextPackage: async (packageId) => {
      assert.equal(packageId, taskContextPackage.packageId);
      return taskContextPackage;
    },
    unavailableResponse: { continued: false },
    missingPackageMessage: (id) => `missing ${id}`,
    missingDefaultMessage: "missing default",
    run: async ({ taskContextPackage: selectedPackage, recommendationRun }) => {
      assert.equal(selectedPackage, taskContextPackage);
      assert.equal(recommendationRun.id, "manual-workflow-action");
      recommendationRun.taskContextPackage = {
        ...recommendationRun.taskContextPackage,
        currentWorkStage: "execution-agent",
      };
      return {
        shouldEmit: true,
        response: { continued: true, error: null },
      };
    },
  });

  assert.equal(result.continued, true);
  assert.equal(result.error, null);
  assert.equal(result.recommendationRun.id, "manual-workflow-action");
  assert.equal(result.recommendationRun.taskContextPackage.currentWorkStage, "execution-agent");
  assert.equal(lifecycle.setCalls.length, 1);
  assert.equal(emitted.length, 1);
});

test("manual workflow action protocol skips action for unavailable targets", async () => {
  const lifecycle = createLifecycle(null);
  const protocol = createManualWorkflowActionProtocol({
    recommendationRunLifecycle: lifecycle,
    emitRecommendationChanged: () => {
      throw new Error("emitRecommendationChanged should not be called");
    },
  });
  let actionCalled = false;

  const result = await protocol.runManualWorkflowAction({
    packageId: null,
    findTaskContextPackage: async () => packageFixture({ currentWorkStage: "closed" }),
    isUnavailable: (taskContextPackage) => taskContextPackage.currentWorkStage === "closed",
    unavailableResponse: { planned: false },
    missingPackageMessage: (id) => `missing ${id}`,
    missingDefaultMessage: "missing default",
    run: async () => {
      actionCalled = true;
      return { shouldEmit: true, response: { planned: true, error: null } };
    },
  });

  assert.equal(result.planned, false);
  assert.equal(result.error, "missing default");
  assert.equal(result.recommendationRun, null);
  assert.equal(actionCalled, false);
  assert.equal(lifecycle.setCalls.length, 0);
});
