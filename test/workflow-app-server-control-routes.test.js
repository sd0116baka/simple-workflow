import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowServiceStub,
  startWorkflowApp,
} from "./support/server-app-fixtures.js";

test("POST /api/server/restart triggers configured restart handler", async (t) => {
  let restartCalled = false;
  const workflowService = createWorkflowServiceStub();
  const { baseUrl } = await startWorkflowApp(t, {
    workflowService,
    restartServer() {
      restartCalled = true;
    },
  });

  const response = await fetch(`${baseUrl}/api/server/restart`, { method: "POST" });
  const payload = await response.json();

  assert.equal(response.status, 202);
  assert.equal(payload.restarting, true);
  assert.equal(restartCalled, true);
});

test("POST /api/server/restart returns unavailable without restart handler", async (t) => {
  const workflowService = createWorkflowServiceStub();
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const response = await fetch(`${baseUrl}/api/server/restart`, { method: "POST" });
  const payload = await response.json();

  assert.equal(response.status, 501);
  assert.match(payload.error, /not available/);
});
