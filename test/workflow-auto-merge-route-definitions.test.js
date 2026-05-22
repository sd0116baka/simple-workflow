import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowAutoMergeRouteDefinitions } from "../src/server/workflow-auto-merge-route-definitions.js";

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

test("auto merge route definitions expose replan route", () => {
  const definitions = createWorkflowAutoMergeRouteDefinitions({
    workflowService: {},
    httpAdapter: createHttpAdapterProbe(),
  });

  assert.deepEqual(
    definitions.map(({ method, path }) => `${method} ${path}`),
    ["POST /api/auto-merge/replan"],
  );
});

test("auto merge replan route maps request body and result status", async () => {
  const httpAdapter = createHttpAdapterProbe({
    packageId: "pkg-1",
  });
  const calls = [];
  const [route] = createWorkflowAutoMergeRouteDefinitions({
    httpAdapter,
    workflowService: {
      async replanAutoMerge(input) {
        calls.push(input);
        return { planned: false, error: "missing target" };
      },
    },
  });
  const response = {};

  await route.handle({ request: {}, response });

  assert.deepEqual(calls, [{ packageId: "pkg-1" }]);
  assert.equal(response.sent.status, 409);
  assert.deepEqual(response.sent.payload, {
    planned: false,
    error: "missing target",
  });
});
