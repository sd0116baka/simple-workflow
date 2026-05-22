import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server/server-app.js";

test("GET /api/events streams workflow events as server-sent events", async (t) => {
  const listeners = new Set();
  const workflowService = {
    async listTasks() {
      return [];
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const port = server.address().port;
  const response = await fetch(`http://localhost:${port}/api/events`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");

  const reader = response.body.getReader();
  for (const listener of listeners) {
    listener({ type: "tasks-changed", fileName: "task.yaml" });
  }

  const decoder = new TextDecoder();
  let body = "";
  for (let i = 0; i < 5 && !body.includes("event: tasks-changed"); i += 1) {
    const chunk = await reader.read();
    body += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
  }
  await reader.cancel();

  assert.match(body, /event: tasks-changed/);
  assert.match(body, /"fileName":"task.yaml"/);
});
