import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server/server-app.js";

test("server app lets workflow routes handle matched requests before static fallback", async (t) => {
  const calls = [];
  const server = createApp({
    workflowRoutes: {
      async handle(request, response) {
        calls.push("routes");
        response.writeHead(202);
        response.end();
        return true;
      },
    },
    httpAdapter: {
      async serveStatic() {
        calls.push("static");
      },
      sendJson() {
        calls.push("json");
      },
    },
  });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(`http://localhost:${server.address().port}/api/task-pool`);

  assert.equal(response.status, 202);
  assert.deepEqual(calls, ["routes"]);
});

test("server app serves static assets when workflow routes do not match", async (t) => {
  const calls = [];
  const server = createApp({
    workflowRoutes: {
      async handle() {
        calls.push("routes");
        return false;
      },
    },
    httpAdapter: {
      async serveStatic(request, response) {
        calls.push("static");
        response.writeHead(204);
        response.end();
      },
      sendJson() {
        calls.push("json");
      },
    },
    logError() {},
  });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(`http://localhost:${server.address().port}/app.js`);

  assert.equal(response.status, 204);
  assert.deepEqual(calls, ["routes", "static"]);
});

test("server app maps unhandled route errors to JSON 500 responses", async (t) => {
  const payloads = [];
  const server = createApp({
    workflowRoutes: {
      async handle() {
        throw new Error("boom");
      },
    },
    httpAdapter: {
      async serveStatic() {
        throw new Error("static should not run");
      },
      sendJson(response, status, payload) {
        payloads.push({ status, payload });
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(payload));
      },
    },
    logError() {},
  });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(`http://localhost:${server.address().port}/api/task-pool`);

  assert.equal(response.status, 500);
  assert.deepEqual(payloads, [
    { status: 500, payload: { error: "Internal server error" } },
  ]);
});
