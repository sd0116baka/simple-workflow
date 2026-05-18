import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server/server.js";

test("GET /api/startup-check returns execution admission startup check", async (t) => {
  const workflowService = {
    async listTasks() {
      return [];
    },
    async listTaskPool() {
      return { entries: [], views: { candidateTasks: [] } };
    },
    async getStartupCheck() {
      return {
        canStartWork: true,
        findings: [],
        runtimeSnapshot: {
          activeWork: null,
          worktree: {
            clean: true,
            changedFiles: [],
          },
        },
      };
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(`http://localhost:${server.address().port}/api/startup-check`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.startupCheck.canStartWork, true);
  assert.equal(payload.startupCheck.runtimeSnapshot.worktree.clean, true);
});
