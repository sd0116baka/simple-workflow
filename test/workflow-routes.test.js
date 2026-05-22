import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowRoutes } from "../src/server/workflow-routes.js";

function createHttpAdapterProbe(body = {}) {
  const calls = [];
  return {
    calls,
    sendJson(response, status, payload) {
      calls.push({ type: "json", status, payload });
      response.sent = { status, payload };
    },
    async readJsonBody() {
      calls.push({ type: "readJsonBody" });
      return body;
    },
    serveEvents(request, response, workflowService) {
      calls.push({ type: "events", workflowService });
      response.eventsServed = true;
    },
  };
}

function request({ method = "GET", url }) {
  return {
    method,
    url,
    headers: {
      host: "localhost",
    },
  };
}

test("workflow routes stream workflow events", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const workflowService = {};
  const response = {};
  const routes = createWorkflowRoutes({ workflowService, httpAdapter });

  const handled = await routes.handle(request({ url: "/api/events" }), response);

  assert.equal(handled, true);
  assert.equal(response.eventsServed, true);
  assert.equal(httpAdapter.calls[0].workflowService, workflowService);
});

test("workflow routes reject starting a recommendation run while one is running", async () => {
  let createCalled = false;
  const latestRun = { id: "run-1", status: "running" };
  const httpAdapter = createHttpAdapterProbe();
  const response = {};
  const routes = createWorkflowRoutes({
    httpAdapter,
    workflowService: {
      getLatestRecommendationRun() {
        return latestRun;
      },
      async createRecommendationRun() {
        createCalled = true;
        return { id: "run-2", status: "running" };
      },
    },
  });

  const handled = await routes.handle(request({ method: "POST", url: "/api/recommendation-runs?from=test" }), response);

  assert.equal(handled, true);
  assert.equal(createCalled, false);
  assert.equal(response.sent.status, 409);
  assert.equal(response.sent.payload.recommendationRun, latestRun);
});

test("workflow routes forward human convergence guidance body", async () => {
  const observed = {};
  const httpAdapter = createHttpAdapterProbe({
    packageId: "pkg-1",
    guidance: "继续收窄执行范围。",
    focusAreas: ["tests"],
    avoidRepeating: "不要重复跑同一个假设。",
    expectedNextOutcome: "证明修复路径。",
  });
  const response = {};
  const routes = createWorkflowRoutes({
    httpAdapter,
    workflowService: {
      async continueConvergenceWithGuidance(input) {
        Object.assign(observed, input);
        return { continued: true };
      },
    },
  });

  const handled = await routes.handle(
    request({ method: "POST", url: "/api/human-decisions/continue-convergence-with-guidance" }),
    response,
  );

  assert.equal(handled, true);
  assert.deepEqual(observed, {
    packageId: "pkg-1",
    guidance: "继续收窄执行范围。",
    focusAreas: ["tests"],
    avoidRepeating: "不要重复跑同一个假设。",
    expectedNextOutcome: "证明修复路径。",
  });
  assert.equal(response.sent.status, 200);
});

test("workflow routes trigger restart only when a restart handler exists", async () => {
  let restartCalled = false;
  const unavailableAdapter = createHttpAdapterProbe();
  const unavailableResponse = {};
  const unavailableRoutes = createWorkflowRoutes({
    httpAdapter: unavailableAdapter,
    workflowService: {},
  });

  await unavailableRoutes.handle(request({ method: "POST", url: "/api/server/restart" }), unavailableResponse);

  const restartAdapter = createHttpAdapterProbe();
  const restartResponse = {};
  const restartRoutes = createWorkflowRoutes({
    httpAdapter: restartAdapter,
    workflowService: {},
    restartServer() {
      restartCalled = true;
    },
  });

  await restartRoutes.handle(request({ method: "POST", url: "/api/server/restart" }), restartResponse);

  assert.equal(unavailableResponse.sent.status, 501);
  assert.equal(restartResponse.sent.status, 202);
  assert.equal(restartCalled, true);
});

test("workflow routes leave unknown or prefixed API paths unhandled", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const routes = createWorkflowRoutes({
    httpAdapter,
    workflowService: {
      async listTasks() {
        throw new Error("must not match prefixed task path");
      },
    },
  });

  assert.equal(await routes.handle(request({ url: "/api/tasks-extra" }), {}), false);
  assert.equal(await routes.handle(request({ url: "/api/unknown" }), {}), false);
  assert.deepEqual(httpAdapter.calls, []);
});
