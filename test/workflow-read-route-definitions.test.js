import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowReadRouteDefinitions } from "../src/server/workflow-read-route-definitions.js";

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

test("workflow read route definitions expose read model routes", () => {
  const definitions = createWorkflowReadRouteDefinitions({
    workflowService: {},
    httpAdapter: createHttpAdapterProbe(),
  });

  assert.deepEqual(
    definitions.map(({ method, path }) => `${method} ${path}`),
    [
      "GET /api/task-pool",
      "GET /api/startup-check",
      "GET /api/tasks",
    ],
  );
});

test("workflow read routes map task pool, startup check, and tasks responses", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const taskPool = [{ id: "task-001" }];
  const startupCheck = { ok: true };
  const tasks = [{ file: "tasks/task-001.yaml" }];
  const calls = [];
  const definitions = createWorkflowReadRouteDefinitions({
    httpAdapter,
    workflowService: {
      async listTaskPool() {
        calls.push("listTaskPool");
        return taskPool;
      },
      async getStartupCheck() {
        calls.push("getStartupCheck");
        return startupCheck;
      },
      async listTasks() {
        calls.push("listTasks");
        return tasks;
      },
    },
  });
  const taskPoolResponse = {};
  const startupCheckResponse = {};
  const tasksResponse = {};

  await findRoute(definitions, {
    method: "GET",
    path: "/api/task-pool",
  }).handle({ response: taskPoolResponse });
  await findRoute(definitions, {
    method: "GET",
    path: "/api/startup-check",
  }).handle({ response: startupCheckResponse });
  await findRoute(definitions, {
    method: "GET",
    path: "/api/tasks",
  }).handle({ response: tasksResponse });

  assert.deepEqual(calls, ["listTaskPool", "getStartupCheck", "listTasks"]);
  assert.equal(taskPoolResponse.sent.status, 200);
  assert.deepEqual(taskPoolResponse.sent.payload, { taskPool });
  assert.equal(startupCheckResponse.sent.status, 200);
  assert.deepEqual(startupCheckResponse.sent.payload, { startupCheck });
  assert.equal(tasksResponse.sent.status, 200);
  assert.deepEqual(tasksResponse.sent.payload, { tasks });
});
