import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server/server.js";

test("GET /api/runtime returns workflow runtime status", async (t) => {
  const workflowService = {
    async listTasks() {
      return [];
    },
    async listTaskPool() {
      return { entries: [] };
    },
    async getRuntimeStatus() {
      return {
        status: "idle",
        canStartNewTask: true,
        runnableTasks: [{ id: "task-runtime", title: "运行时调度器" }],
        blockingReasons: [],
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

  const response = await fetch(`http://localhost:${server.address().port}/api/runtime`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.runtimeStatus.status, "idle");
  assert.deepEqual(payload.runtimeStatus.runnableTasks.map((task) => task.id), ["task-runtime"]);
});
