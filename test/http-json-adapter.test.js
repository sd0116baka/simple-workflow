import { PassThrough } from "node:stream";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHttpJsonAdapter } from "../src/server/http-json-adapter.js";

function createResponseProbe() {
  return {
    status: null,
    headers: null,
    chunks: [],
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
    },
    end(chunk = "") {
      this.chunks.push(String(chunk));
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

test("HTTP JSON adapter writes JSON responses", () => {
  const adapter = createHttpJsonAdapter();
  const response = createResponseProbe();

  adapter.sendJson(response, 201, { ok: true });

  assert.equal(response.status, 201);
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(response.text(), '{"ok":true}');
});

test("HTTP JSON adapter reads JSON request bodies and treats blank bodies as empty objects", async () => {
  const adapter = createHttpJsonAdapter();

  assert.deepEqual(await adapter.readJsonBody(createRequestBody("  ")), {});
  assert.deepEqual(await adapter.readJsonBody(createRequestBody('{"packageId":"pkg-1"}')), {
    packageId: "pkg-1",
  });
});
