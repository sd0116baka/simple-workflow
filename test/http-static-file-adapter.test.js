import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHttpStaticFileAdapter } from "../src/server/http-static-file-adapter.js";

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
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    },
    text() {
      return this.chunks.join("");
    },
  };
}

test("HTTP static file adapter serves public assets without cache headers", async () => {
  const publicDir = await mkdtemp(join(tmpdir(), "simple-workflow-public-"));
  await writeFile(join(publicDir, "app.js"), "console.log('ok');", "utf8");
  const adapter = createHttpStaticFileAdapter({ publicDir });
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

test("HTTP static file adapter rejects paths outside the public directory", async () => {
  const publicDir = await mkdtemp(join(tmpdir(), "simple-workflow-public-"));
  const adapter = createHttpStaticFileAdapter({ publicDir });
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
