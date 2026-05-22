import { EventEmitter } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHttpEventStreamAdapter } from "../src/server/http-event-stream-adapter.js";

function createResponseProbe() {
  return {
    status: null,
    headers: null,
    chunks: [],
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
    },
    write(chunk) {
      this.chunks.push(String(chunk));
    },
    text() {
      return this.chunks.join("");
    },
  };
}

test("HTTP event stream adapter streams workflow events and unsubscribes on close", () => {
  const adapter = createHttpEventStreamAdapter();
  const request = new EventEmitter();
  const response = createResponseProbe();
  const listeners = new Set();
  const workflowService = {
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  adapter.serveEvents(request, response, workflowService);
  for (const listener of listeners) {
    listener({ type: "tasks-changed", fileName: "task.yaml" });
  }
  request.emit("close");

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "text/event-stream; charset=utf-8");
  assert.match(response.text(), /: connected/);
  assert.match(response.text(), /event: tasks-changed/);
  assert.match(response.text(), /"fileName":"task.yaml"/);
  assert.equal(listeners.size, 0);
});
