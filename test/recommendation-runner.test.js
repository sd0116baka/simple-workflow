import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTextFromJsonEvents, toProgressEntry } from "../src/workflow/recommendation-runner.js";

test("extracts final text from opencode JSON events", () => {
  const output = [
    JSON.stringify({ type: "step_start", part: { type: "step-start" } }),
    JSON.stringify({ type: "text", part: { type: "text", text: "```json\n{\"ok\":true}\n```" } }),
    JSON.stringify({ type: "step_finish", part: { type: "step-finish" } }),
  ].join("\n");

  assert.equal(extractTextFromJsonEvents(output), "```json\n{\"ok\":true}\n```");
});

test("falls back to raw output when stdout is not JSON events", () => {
  const output = "plain stdout";

  assert.equal(extractTextFromJsonEvents(output), output);
});

test("maps opencode JSON events to progress entries", () => {
  assert.deepEqual(toProgressEntry({ type: "step_start" }), {
    type: "step_start",
    stream: "opencode",
    message: "开始运行 opencode",
    terminalLine: "opencode: step_start",
  });
  assert.deepEqual(toProgressEntry({ type: "text" }), {
    type: "text",
    stream: "opencode",
    message: "收到模型输出",
    terminalLine: "opencode: text",
  });
  assert.deepEqual(toProgressEntry({ type: "step_finish", part: { reason: "stop" } }), {
    type: "step_finish",
    stream: "opencode",
    message: "运行结束：stop",
    terminalLine: "opencode: step_finish stop",
  });
});
