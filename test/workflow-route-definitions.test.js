import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowRouteDefinitions } from "../src/server/workflow-route-definitions.js";

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

test("workflow route definitions expose method and path metadata", () => {
  const definitions = createWorkflowRouteDefinitions({
    workflowService: {},
    httpAdapter: createHttpAdapterProbe(),
  });

  assert.deepEqual(
    definitions.map(({ method = "*", path }) => `${method} ${path}`),
    [
      "* /api/events",
      "POST /api/recommendation-runs/cancel",
      "POST /api/recommendation-runs",
      "GET /api/recommendation-runs/latest",
      "POST /api/human-decisions/accept-convergence",
      "POST /api/human-decisions/continue-convergence-with-guidance",
      "POST /api/human-decisions/cancel-task",
      "POST /api/auto-merge/replan",
      "POST /api/server/restart",
      "POST /api/test-fixtures/state-stubs",
      "DELETE /api/test-fixtures/state-stubs",
      "GET /api/task-pool",
      "GET /api/startup-check",
      "GET /api/tasks",
    ],
  );
});
