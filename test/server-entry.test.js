import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDirectRun } from "../src/server/server.js";

test("detects direct execution from a Windows-style argv path", () => {
  const scriptPath = join(process.cwd(), "src", "server", "server.js");
  const moduleUrl = pathToFileURL(scriptPath).href;

  assert.equal(isDirectRun(moduleUrl, scriptPath), true);
});
