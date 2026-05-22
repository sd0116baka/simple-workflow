import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowTestFixtureRouteDefinitions } from "../src/server/workflow-test-fixture-route-definitions.js";

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

function findRoute(definitions, { method, path }) {
  return definitions.find((definition) => definition.path === path && definition.method === method);
}

test("test fixture route definitions expose state fixture routes", () => {
  const definitions = createWorkflowTestFixtureRouteDefinitions({
    workflowService: {},
    httpAdapter: createHttpAdapterProbe(),
  });

  assert.deepEqual(
    definitions.map(({ method, path }) => `${method} ${path}`),
    [
      "POST /api/test-fixtures/state-stubs",
      "DELETE /api/test-fixtures/state-stubs",
    ],
  );
});

test("test fixture routes map seed and cleanup successes", async () => {
  const httpAdapter = createHttpAdapterProbe({
    fixtureKey: "human-guided-execution",
  });
  const calls = [];
  const definitions = createWorkflowTestFixtureRouteDefinitions({
    httpAdapter,
    workflowService: {
      async seedTestStateFixtures(input) {
        calls.push({ action: "seed", input });
        return { seeded: true };
      },
      async cleanupTestStateFixtures() {
        calls.push({ action: "cleanup" });
        return { cleaned: true };
      },
    },
  });
  const seedResponse = {};
  const cleanupResponse = {};

  await findRoute(definitions, {
    method: "POST",
    path: "/api/test-fixtures/state-stubs",
  }).handle({ request: {}, response: seedResponse });
  await findRoute(definitions, {
    method: "DELETE",
    path: "/api/test-fixtures/state-stubs",
  }).handle({ response: cleanupResponse });

  assert.deepEqual(calls, [
    { action: "seed", input: { fixtureKey: "human-guided-execution" } },
    { action: "cleanup" },
  ]);
  assert.equal(seedResponse.sent.status, 201);
  assert.deepEqual(seedResponse.sent.payload, { seeded: true });
  assert.equal(cleanupResponse.sent.status, 200);
  assert.deepEqual(cleanupResponse.sent.payload, { cleaned: true });
});

test("test fixture routes isolate fixture errors from the dispatcher", async () => {
  const httpAdapter = createHttpAdapterProbe({
    fixtureKey: "human-guided-execution",
  });
  const definitions = createWorkflowTestFixtureRouteDefinitions({
    httpAdapter,
    workflowService: {
      async seedTestStateFixtures(input) {
        assert.deepEqual(input, { fixtureKey: "human-guided-execution" });
        throw new Error("outside managed test environment");
      },
      async cleanupTestStateFixtures() {
        throw new Error("cleanup denied");
      },
    },
  });
  const seedResponse = {};
  const cleanupResponse = {};

  await findRoute(definitions, {
    method: "POST",
    path: "/api/test-fixtures/state-stubs",
  }).handle({ request: {}, response: seedResponse });
  await findRoute(definitions, {
    method: "DELETE",
    path: "/api/test-fixtures/state-stubs",
  }).handle({ response: cleanupResponse });

  assert.equal(seedResponse.sent.status, 409);
  assert.deepEqual(seedResponse.sent.payload, {
    error: "outside managed test environment",
  });
  assert.equal(cleanupResponse.sent.status, 409);
  assert.deepEqual(cleanupResponse.sent.payload, {
    error: "cleanup denied",
  });
});
