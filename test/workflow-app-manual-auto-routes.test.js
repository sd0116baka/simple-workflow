import { test } from "node:test";
import assert from "node:assert/strict";
import { createSucceededRecommendationRunFixture } from "./support/recommendation-run-fixtures.js";
import {
  createWorkflowServiceStub,
  startWorkflowApp,
} from "./support/server-app-fixtures.js";

test("POST /api/human-decisions/accept-convergence accepts convergence success", async (t) => {
  const latestRun = createSucceededRecommendationRunFixture({
    id: "recommendation-run-test",
  });
  let observedPackageId = null;
  const workflowService = createWorkflowServiceStub({
    async acceptConvergenceSuccess({ packageId }) {
      observedPackageId = packageId;
      return {
        accepted: true,
        planned: true,
        executed: true,
        closed: true,
        error: null,
        recommendationRun: latestRun,
      };
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
  });
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const response = await fetch(`${baseUrl}/api/human-decisions/accept-convergence`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      packageId: "task-context-package:tasks/task-001.yaml",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.accepted, true);
  assert.equal(payload.planned, true);
  assert.equal(payload.executed, true);
  assert.equal(payload.closed, true);
  assert.equal(payload.recommendationRun.status, "succeeded");
  assert.equal(observedPackageId, "task-context-package:tasks/task-001.yaml");
});

test("POST /api/human-decisions/continue-convergence-with-guidance continues convergence", async (t) => {
  const latestRun = createSucceededRecommendationRunFixture({
    id: "recommendation-run-test",
  });
  let observedBody = null;
  const workflowService = createWorkflowServiceStub({
    async continueConvergenceWithGuidance(body) {
      observedBody = body;
      return {
        continued: true,
        error: null,
        recommendationRun: latestRun,
      };
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
  });
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const response = await fetch(`${baseUrl}/api/human-decisions/continue-convergence-with-guidance`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      packageId: "task-context-package:tasks/task-001.yaml",
      guidance: "先收窄候选任务状态。",
      expectedNextOutcome: "下一轮证明候选集正确。",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.continued, true);
  assert.equal(observedBody.packageId, "task-context-package:tasks/task-001.yaml");
  assert.equal(observedBody.guidance, "先收窄候选任务状态。");
  assert.equal(observedBody.expectedNextOutcome, "下一轮证明候选集正确。");
});

test("POST /api/human-decisions/cancel-task cancels convergence-failed task", async (t) => {
  const latestRun = createSucceededRecommendationRunFixture({
    id: "recommendation-run-test",
  });
  let observedPackageId = null;
  const workflowService = createWorkflowServiceStub({
    async cancelTask({ packageId }) {
      observedPackageId = packageId;
      return {
        cancelled: true,
        error: null,
        recommendationRun: latestRun,
      };
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
  });
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const response = await fetch(`${baseUrl}/api/human-decisions/cancel-task`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      packageId: "task-context-package:tasks/task-001.yaml",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.cancelled, true);
  assert.equal(observedPackageId, "task-context-package:tasks/task-001.yaml");
});

test("POST /api/auto-merge/replan regenerates auto-merge plan only", async (t) => {
  const latestRun = createSucceededRecommendationRunFixture({
    id: "recommendation-run-test",
  });
  let observedPackageId = null;
  const workflowService = createWorkflowServiceStub({
    async replanAutoMerge({ packageId }) {
      observedPackageId = packageId;
      return {
        planned: true,
        error: null,
        recommendationRun: latestRun,
      };
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
  });
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const response = await fetch(`${baseUrl}/api/auto-merge/replan`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      packageId: "task-context-package:tasks/task-004.yaml",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.planned, true);
  assert.equal(payload.recommendationRun.status, "succeeded");
  assert.equal(observedPackageId, "task-context-package:tasks/task-004.yaml");
});
