import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRawTask } from "../src/workflow/task-parser.js";

test("parses YAML task text into structured data", () => {
  const result = parseRawTask({
    format: "yaml",
    rawText: "id: task-001\ntitle: 展示任务真源\nacceptance:\n  - 界面能列出任务文件\n",
  });

  assert.deepEqual(result, {
    parsed: {
      id: "task-001",
      title: "展示任务真源",
      acceptance: ["界面能列出任务文件"],
    },
    parseError: null,
  });
});

test("returns a parse error without throwing when raw text is invalid", () => {
  const result = parseRawTask({
    format: "yaml",
    rawText: "id: task-001\nacceptance:\n  - ok\n - broken",
  });

  assert.equal(result.parsed, null);
  assert.match(result.parseError, /yaml/i);
});
