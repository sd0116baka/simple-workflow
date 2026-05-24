import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowRecommendationRunRouteDefinitions } from "../src/server/workflow-recommendation-run-route-definitions.js";

const DEFAULT_STAGE_SWITCHES = {
  executionAdmission: true,
  isolatedWorkspace: true,
  mainAgent: true,
  executionAgent: true,
  reviewAgent: true,
  convergence: true,
};

function createHttpAdapterProbe() {
  const calls = [];
  return {
    calls,
    sendJson(response, status, payload) {
      calls.push({ type: "json", status, payload });
      response.sent = { status, payload };
    },
    async readJsonBody(request) {
      calls.push({ type: "readJsonBody", request });
      return request.body ?? {};
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
      "GET /api/recommendation-runs/:id/progress-log",
      "PATCH /api/recommendation-runs/stage-switches",
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

test("recommendation run route passes probe mode to the workflow service", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const createdRun = { id: "recommendation-run:001", mode: "probe", status: "running" };
  const calls = [];
  const definitions = createWorkflowRecommendationRunRouteDefinitions({
    httpAdapter,
    workflowService: {
      getLatestRecommendationRun() {
        return null;
      },
      async createRecommendationRun(input) {
        calls.push(input);
        return createdRun;
      },
    },
  });
  const request = { body: { mode: "probe" } };
  const response = {};

  await findRoute(definitions, {
    method: "POST",
    path: "/api/recommendation-runs",
  }).handle({ request, response });

  assert.deepEqual(calls, [{ mode: "probe", stageSwitches: DEFAULT_STAGE_SWITCHES }]);
  assert.equal(response.sent.status, 201);
  assert.deepEqual(response.sent.payload, { recommendationRun: createdRun });
});

test("recommendation run route defaults to workflow mode", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const calls = [];
  const definitions = createWorkflowRecommendationRunRouteDefinitions({
    httpAdapter,
    workflowService: {
      getLatestRecommendationRun() {
        return null;
      },
      async createRecommendationRun(input) {
        calls.push(input);
        return { id: "recommendation-run:001", mode: input.mode };
      },
    },
  });
  const response = {};

  await findRoute(definitions, {
    method: "POST",
    path: "/api/recommendation-runs",
  }).handle({ response });

  assert.deepEqual(calls, [{ mode: "workflow", stageSwitches: DEFAULT_STAGE_SWITCHES }]);
  assert.equal(response.sent.payload.recommendationRun.mode, "workflow");
});

test("recommendation run route passes normalized stage switches", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const calls = [];
  const definitions = createWorkflowRecommendationRunRouteDefinitions({
    httpAdapter,
    workflowService: {
      getLatestRecommendationRun() {
        return null;
      },
      async createRecommendationRun(input) {
        calls.push(input);
        return { id: "recommendation-run:001", mode: input.mode };
      },
    },
  });
  const request = {
    body: {
      stageSwitches: {
        executionAdmission: false,
        mainAgent: false,
        reviewAgent: true,
      },
    },
  };
  const response = {};

  await findRoute(definitions, {
    method: "POST",
    path: "/api/recommendation-runs",
  }).handle({ request, response });

  assert.deepEqual(calls, [{
    mode: "workflow",
    stageSwitches: {
      executionAdmission: false,
      isolatedWorkspace: true,
      mainAgent: false,
      executionAgent: true,
      reviewAgent: true,
      convergence: true,
    },
  }]);
  assert.equal(response.sent.status, 201);
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

test("recommendation run route reads a persisted progress log", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const progressLog = {
    runId: "recommendation-run-1",
    events: [{ type: "run_started" }],
  };
  const definitions = createWorkflowRecommendationRunRouteDefinitions({
    httpAdapter,
    workflowService: {
      readRecommendationRunProgressLog(runId) {
        return {
          ...progressLog,
          runId,
        };
      },
    },
  });
  const response = {};

  await findRoute(definitions, {
    method: "GET",
    path: "/api/recommendation-runs/:id/progress-log",
  }).handle({
    response,
    params: {
      id: "recommendation-run-1",
    },
  });

  assert.equal(response.sent.status, 200);
  assert.deepEqual(response.sent.payload, {
    progressLog,
  });
});

test("recommendation run route updates live stage switches", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const calls = [];
  const updatedRun = { id: "recommendation-run:001" };
  const definitions = createWorkflowRecommendationRunRouteDefinitions({
    httpAdapter,
    workflowService: {
      updateRecommendationRunStageSwitches(input) {
        calls.push(input);
        return { updated: true, recommendationRun: updatedRun };
      },
    },
  });
  const response = {};

  await findRoute(definitions, {
    method: "PATCH",
    path: "/api/recommendation-runs/stage-switches",
  }).handle({
    request: {
      body: {
        stageSwitches: {
          executionAdmission: false,
          mainAgent: false,
        },
      },
    },
    response,
  });

  assert.deepEqual(calls, [{
    stageSwitches: {
      executionAdmission: false,
      isolatedWorkspace: true,
      mainAgent: false,
      executionAgent: true,
      reviewAgent: true,
      convergence: true,
    },
  }]);
  assert.equal(response.sent.status, 200);
  assert.deepEqual(response.sent.payload, {
    updated: true,
    recommendationRun: updatedRun,
  });
});
