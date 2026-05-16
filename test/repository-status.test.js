import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGitPorcelainStatus } from "../src/workflow/repository-status.js";

test("parses a clean git porcelain status", () => {
  assert.deepEqual(parseGitPorcelainStatus(""), {
    clean: true,
    entries: [],
  });
});

test("parses dirty git porcelain status entries", () => {
  assert.deepEqual(parseGitPorcelainStatus(" M public/app.js\n?? tasks/task-002.yaml\n"), {
    clean: false,
    entries: [
      { code: "M", path: "public/app.js" },
      { code: "??", path: "tasks/task-002.yaml" },
    ],
  });
});
