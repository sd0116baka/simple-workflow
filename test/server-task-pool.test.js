import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server/server-app.js";

test("GET /api/task-pool returns the workflow task pool", async (t) => {
  const workflowService = {
    async listTasks() {
      return [];
    },
    async listTaskPool() {
      return {
        entries: [
          {
            id: "task-pool",
            sourceFile: "task.yaml",
            title: "任务池",
            type: "feature",
            priority: null,
            status: "ready",
            parsed: { id: "task-pool" },
            validation: { status: "valid", errors: [] },
          },
        ],
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

  const response = await fetch(`http://localhost:${server.address().port}/api/task-pool`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.taskPool.entries.map((entry) => entry.id), ["task-pool"]);
});
