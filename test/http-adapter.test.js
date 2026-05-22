import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHttpAdapter } from "../src/server/http-adapter.js";

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
    end(chunk = "") {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    },
    text() {
      return this.chunks.join("");
    },
  };
}

function createRequestBody(body) {
  const request = new PassThrough();
  request.end(body);
  return request;
}

test("HTTP adapter writes JSON responses", () => {
  const adapter = createHttpAdapter({ publicDir: process.cwd() });
  const response = createResponseProbe();

  adapter.sendJson(response, 201, { ok: true });

  assert.equal(response.status, 201);
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(response.text(), '{"ok":true}');
});

test("HTTP adapter reads JSON request bodies and treats blank bodies as empty objects", async () => {
  const adapter = createHttpAdapter({ publicDir: process.cwd() });

  assert.deepEqual(await adapter.readJsonBody(createRequestBody("  ")), {});
  assert.deepEqual(await adapter.readJsonBody(createRequestBody('{"packageId":"pkg-1"}')), {
    packageId: "pkg-1",
  });
});

test("HTTP adapter streams workflow events as server-sent events and unsubscribes on close", () => {
  const adapter = createHttpAdapter({ publicDir: process.cwd() });
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

test("HTTP adapter serves static assets without cache headers", async () => {
  const publicDir = await mkdtemp(join(tmpdir(), "simple-workflow-public-"));
  await writeFile(join(publicDir, "app.js"), "console.log('ok');", "utf8");
  const adapter = createHttpAdapter({ publicDir });
  const response = createResponseProbe();

  await adapter.serveStatic(
    {
      url: "/app.js",
      headers: { host: "localhost" },
    },
    response,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/javascript; charset=utf-8");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.text(), "console.log('ok');");
});

test("HTTP adapter rejects static paths outside the public directory", async () => {
  const publicDir = await mkdtemp(join(tmpdir(), "simple-workflow-public-"));
  const adapter = createHttpAdapter({ publicDir });
  const response = createResponseProbe();

  await adapter.serveStatic(
    {
      url: "/..%2Fsecret.txt",
      headers: { host: "localhost" },
    },
    response,
  );

  assert.equal(response.status, 403);
  assert.equal(response.text(), "Forbidden");
});
