import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowServerControlRouteDefinitions } from "../src/server/workflow-server-control-route-definitions.js";

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

test("server control route definitions expose restart route", () => {
  const definitions = createWorkflowServerControlRouteDefinitions({
    httpAdapter: createHttpAdapterProbe(),
  });

  assert.deepEqual(
    definitions.map(({ method, path }) => `${method} ${path}`),
    ["POST /api/server/restart"],
  );
});

test("server restart route returns unavailable without a restart handler", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const [route] = createWorkflowServerControlRouteDefinitions({
    httpAdapter,
  });
  const response = {};

  await route.handle({ response });

  assert.equal(response.sent.status, 501);
  assert.deepEqual(response.sent.payload, {
    error: "Server restart is not available.",
  });
});

test("server restart route acknowledges before invoking restart handler", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const calls = [];
  const [route] = createWorkflowServerControlRouteDefinitions({
    httpAdapter,
    restartServer() {
      calls.push("restartServer");
    },
  });
  const response = {};

  await route.handle({ response });

  assert.equal(response.sent.status, 202);
  assert.deepEqual(response.sent.payload, { restarting: true });
  assert.deepEqual(calls, ["restartServer"]);
});
