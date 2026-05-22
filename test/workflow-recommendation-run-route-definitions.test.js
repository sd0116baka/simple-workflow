import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowRecommendationRunRouteDefinitions } from "../src/server/workflow-recommendation-run-route-definitions.js";

function createHttpAdapterProbe() {
  const calls = [];
  return {
    calls,
    sendJson(response, status, payload) {
      calls.push({ type: "json", status, payload });
      response.sent = { status, payload };
    },
  };
}

function findRoute(definitions, { method, path }) {
  return definitions.find((definition) => definition.path === path && definition.method === method);
}

test("recommendation run route definitions expose run lifecycle routes", () => {
  const definitions = createWorkflowRecommendationRunRouteDefinitions({
    workflowService: {},
    httpAdapter: createHttpAdapterProbe(),
  });

  assert.deepEqual(
    definitions.map(({ method, path }) => `${method} ${path}`),
    [
      "POST /api/recommendation-runs/cancel",
      "POST /api/recommendation-runs",
      "GET /api/recommendation-runs/latest",
    ],
  );
});

test("recommendation run route starts a run when no run is active", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const createdRun = { id: "recommendation-run:001", status: "running" };
  const definitions = createWorkflowRecommendationRunRouteDefinitions({
    httpAdapter,
    workflowService: {
      getLatestRecommendationRun() {
        return null;
      },
      async createRecommendationRun() {
        return createdRun;
      },
    },
  });
  const response = {};

  await findRoute(definitions, {
    method: "POST",
    path: "/api/recommendation-runs",
  }).handle({ response });

  assert.equal(response.sent.status, 201);
  assert.deepEqual(response.sent.payload, { recommendationRun: createdRun });
});

test("recommendation run route rejects start while a run is active", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const runningRun = { id: "recommendation-run:001", status: "running" };
  let createCalled = false;
  const definitions = createWorkflowRecommendationRunRouteDefinitions({
    httpAdapter,
    workflowService: {
      getLatestRecommendationRun() {
        return runningRun;
      },
      async createRecommendationRun() {
        createCalled = true;
        return { id: "unexpected" };
      },
    },
  });
  const response = {};

  await findRoute(definitions, {
    method: "POST",
    path: "/api/recommendation-runs",
  }).handle({ response });

  assert.equal(response.sent.status, 409);
  assert.equal(response.sent.payload.recommendationRun, runningRun);
  assert.match(response.sent.payload.error, /已有推荐器流程正在运行/);
  assert.equal(createCalled, false);
});

test("recommendation run routes map cancel and latest responses", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const latestRun = { id: "recommendation-run:002", status: "completed" };
  const definitions = createWorkflowRecommendationRunRouteDefinitions({
    httpAdapter,
    workflowService: {
      cancelRecommendationRun() {
        return { cancelled: false, error: "no running run" };
      },
      getLatestRecommendationRun() {
        return latestRun;
      },
    },
  });
  const cancelResponse = {};
  const latestResponse = {};

  await findRoute(definitions, {
    method: "POST",
    path: "/api/recommendation-runs/cancel",
  }).handle({ response: cancelResponse });
  await findRoute(definitions, {
    method: "GET",
    path: "/api/recommendation-runs/latest",
  }).handle({ response: latestResponse });

  assert.equal(cancelResponse.sent.status, 409);
  assert.deepEqual(cancelResponse.sent.payload, {
    cancelled: false,
    error: "no running run",
  });
  assert.equal(latestResponse.sent.status, 200);
  assert.deepEqual(latestResponse.sent.payload, {
    recommendationRun: latestRun,
  });
});
