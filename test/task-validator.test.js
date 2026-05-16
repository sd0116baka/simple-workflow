import { test } from "node:test";
import assert from "node:assert/strict";
import { validateParsedTask } from "../src/workflow/task-validator.js";

test("accepts a parsed task with the minimum required fields", () => {
  const validation = validateParsedTask({
    parsed: {
      id: "task-001",
      title: "展示任务真源",
      type: "feature",
      description: "读取并展示 YAML 任务",
      acceptance: ["界面能列出任务文件"],
    },
    parseError: null,
  });

  assert.deepEqual(validation, {
    status: "valid",
    errors: [],
  });
});

test("reports missing and invalid required fields", () => {
  const validation = validateParsedTask({
    parsed: {
      id: "",
      type: "feature",
      description: "缺少标题和验收标准",
      acceptance: [],
    },
    parseError: null,
  });

  assert.equal(validation.status, "invalid");
  assert.deepEqual(validation.errors, [
    "id must be a non-empty string",
    "title must be a non-empty string",
    "acceptance must contain at least one item",
  ]);
});

test("blocks validation when parsing failed", () => {
  const validation = validateParsedTask({
    parsed: null,
    parseError: "YAML parse error: bad indentation",
  });

  assert.deepEqual(validation, {
    status: "invalid",
    errors: ["Cannot validate until YAML parses successfully"],
  });
});
