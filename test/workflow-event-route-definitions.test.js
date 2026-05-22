import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowEventRouteDefinitions } from "../src/server/workflow-event-route-definitions.js";

function createHttpAdapterProbe() {
  const calls = [];
  return {
    calls,
    serveEvents(request, response, workflowService) {
      calls.push({ type: "events", request, response, workflowService });
      response.eventsServed = true;
    },
  };
}

test("workflow event route definitions expose event stream route", () => {
  const definitions = createWorkflowEventRouteDefinitions({
    workflowService: {},
    httpAdapter: createHttpAdapterProbe(),
  });

  assert.deepEqual(
    definitions.map(({ method = "*", path }) => `${method} ${path}`),
    ["* /api/events"],
  );
});

test("workflow event route delegates SSE lifecycle to the HTTP adapter", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const workflowService = { service: "workflow" };
  const request = { url: "/api/events" };
  const response = {};
  const [route] = createWorkflowEventRouteDefinitions({
    workflowService,
    httpAdapter,
  });

  await route.handle({ request, response });

  assert.equal(response.eventsServed, true);
  assert.deepEqual(httpAdapter.calls, [
    {
      type: "events",
      request,
      response,
      workflowService,
    },
  ]);
});
