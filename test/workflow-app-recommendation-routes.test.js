import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRecommendationRunFixture,
  createRunningRecommendationRunFixture,
} from "./support/recommendation-run-fixtures.js";
import {
  createWorkflowServiceStub,
  startWorkflowApp,
} from "./support/server-app-fixtures.js";

test("POST /api/recommendation-runs starts a run and latest returns the snapshot", async (t) => {
  const latestRun = createRunningRecommendationRunFixture({
    id: "recommendation-run-test",
    startedAt: "2026-05-16T00:00:00.000Z",
    finishedAt: null,
    args: ["run", "--format", "json"],
    error: null,
  });
  let currentRun = null;
  const workflowService = createWorkflowServiceStub({
    async createRecommendationRun() {
      currentRun = latestRun;
      return latestRun;
    },
    getLatestRecommendationRun() {
      return currentRun;
    },
  });
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const createResponse = await fetch(`${baseUrl}/api/recommendation-runs`, { method: "POST" });
  const createPayload = await createResponse.json();
  const latestResponse = await fetch(`${baseUrl}/api/recommendation-runs/latest`);
  const latestPayload = await latestResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.recommendationRun.status, "running");
  assert.equal(latestResponse.status, 200);
  assert.equal(latestPayload.recommendationRun.id, "recommendation-run-test");
});

test("POST /api/recommendation-runs returns conflict when a run is already running", async (t) => {
  const latestRun = createRunningRecommendationRunFixture({
    id: "recommendation-run-busy",
    startedAt: "2026-05-16T00:00:00.000Z",
    finishedAt: null,
    args: ["run", "--format", "json"],
    error: null,
  });
  let createCalled = false;
  const workflowService = createWorkflowServiceStub({
    async createRecommendationRun() {
      createCalled = true;
      return latestRun;
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
  });
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const response = await fetch(`${baseUrl}/api/recommendation-runs`, { method: "POST" });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(createCalled, false);
  assert.match(payload.error, /正在运行/);
  assert.equal(payload.recommendationRun.id, "recommendation-run-busy");
});

test("POST /api/recommendation-runs/cancel cancels the latest run", async (t) => {
  const latestRun = createRecommendationRunFixture({
    id: "recommendation-run-test",
    status: "cancelled",
    startedAt: "2026-05-16T00:00:00.000Z",
    finishedAt: "2026-05-16T00:00:01.000Z",
    args: ["run", "--format", "json"],
    error: "cancelled",
  });
  const workflowService = createWorkflowServiceStub({
    cancelRecommendationRun() {
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

  const response = await fetch(`${baseUrl}/api/recommendation-runs/cancel`, { method: "POST" });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.cancelled, true);
  assert.equal(payload.recommendationRun.status, "cancelled");
});
