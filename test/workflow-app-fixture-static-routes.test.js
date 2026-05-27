import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowServiceStub,
  startWorkflowApp,
} from "./support/server-app-fixtures.js";

test("POST /api/test-fixtures/state-stubs seeds test state fixtures", async (t) => {
  let observedFixtureKey = null;
  const workflowService = createWorkflowServiceStub({
    async seedTestStateFixtures({ fixtureKey }) {
      observedFixtureKey = fixtureKey;
      return {
        count: 1,
        tasks: [
          {
            packageId: "task-context-package:tasks/stub-convergence-failure.yaml",
            sourcePath: "tasks/stub-convergence-failure.yaml",
            currentWorkStage: "human-decision",
          },
        ],
      };
    },
  });
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const response = await fetch(`${baseUrl}/api/test-fixtures/state-stubs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ fixtureKey: "convergence-failure" }),
  });
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.count, 1);
  assert.equal(payload.tasks[0].currentWorkStage, "human-decision");
  assert.equal(observedFixtureKey, "convergence-failure");
});

test("DELETE /api/test-fixtures/state-stubs cleans test state fixtures", async (t) => {
  const workflowService = createWorkflowServiceStub({
    async cleanupTestStateFixtures() {
      return {
        removedTaskFiles: 1,
        removedPackages: 1,
      };
    },
  });
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const response = await fetch(`${baseUrl}/api/test-fixtures/state-stubs`, { method: "DELETE" });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.removedTaskFiles, 1);
  assert.equal(payload.removedPackages, 1);
});

test("static assets are not cached during workflow UI development", async (t) => {
  const workflowService = createWorkflowServiceStub();
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const response = await fetch(`${baseUrl}/app.js`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("user UI is served as a static page independent from debug UI assets", async (t) => {
  const workflowService = createWorkflowServiceStub();
  const { baseUrl } = await startWorkflowApp(t, { workflowService });

  const response = await fetch(`${baseUrl}/user.html`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /id="userApp"/);
  assert.match(html, /\/user-app\.js/);
  assert.match(html, /\/user-styles\.css/);
  assert.doesNotMatch(html, /\/app\.js/);
  assert.doesNotMatch(html, /\/styles\.css/);
});
