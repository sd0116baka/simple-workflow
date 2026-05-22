import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowManualActionRouteDefinitions } from "../src/server/workflow-manual-action-route-definitions.js";

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
  };
}

function findRoute(definitions, path) {
  return definitions.find((definition) => definition.path === path);
}

test("manual action route definitions expose human-decision routes", () => {
  const definitions = createWorkflowManualActionRouteDefinitions({
    workflowService: {},
    httpAdapter: createHttpAdapterProbe(),
  });

  assert.deepEqual(
    definitions.map(({ method, path }) => `${method} ${path}`),
    [
      "POST /api/human-decisions/accept-convergence",
      "POST /api/human-decisions/continue-convergence-with-guidance",
      "POST /api/human-decisions/cancel-task",
    ],
  );
});

test("manual action routes map request bodies and result status", async () => {
  const httpAdapter = createHttpAdapterProbe({
    packageId: "pkg-1",
    guidance: "继续",
    focusAreas: ["测试"],
    avoidRepeating: ["重复"],
    expectedNextOutcome: "通过",
  });
  const calls = [];
  const definitions = createWorkflowManualActionRouteDefinitions({
    httpAdapter,
    workflowService: {
      async acceptConvergenceSuccess(input) {
        calls.push({ action: "accept", input });
        return { accepted: false, error: "missing target" };
      },
      async continueConvergenceWithGuidance(input) {
        calls.push({ action: "continue", input });
        return { continued: true, error: null };
      },
      async cancelTask(input) {
        calls.push({ action: "cancel", input });
        return { cancelled: false, error: "missing target" };
      },
    },
  });

  const acceptResponse = {};
  await findRoute(definitions, "/api/human-decisions/accept-convergence").handle({
    request: {},
    response: acceptResponse,
  });
  const continueResponse = {};
  await findRoute(definitions, "/api/human-decisions/continue-convergence-with-guidance").handle({
    request: {},
    response: continueResponse,
  });
  const cancelResponse = {};
  await findRoute(definitions, "/api/human-decisions/cancel-task").handle({
    request: {},
    response: cancelResponse,
  });

  assert.deepEqual(calls, [
    { action: "accept", input: { packageId: "pkg-1" } },
    {
      action: "continue",
      input: {
        packageId: "pkg-1",
        guidance: "继续",
        focusAreas: ["测试"],
        avoidRepeating: ["重复"],
        expectedNextOutcome: "通过",
      },
    },
    { action: "cancel", input: { packageId: "pkg-1" } },
  ]);
  assert.equal(acceptResponse.sent.status, 409);
  assert.equal(continueResponse.sent.status, 200);
  assert.equal(cancelResponse.sent.status, 409);
});
