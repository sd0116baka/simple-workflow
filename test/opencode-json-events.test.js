import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractTextFromJsonEvents,
  findSessionIdInJsonEvents,
  toOpencodeProgressEntry,
} from "../src/workflow/opencode-json-events.js";

test("extracts final text from opencode JSON events", () => {
  const output = [
    JSON.stringify({ type: "step_start", part: { type: "step-start" } }),
    JSON.stringify({ type: "text", part: { type: "text", text: "```json\n{\"ok\":true}\n```" } }),
    JSON.stringify({ type: "step_finish", part: { type: "step-finish" } }),
  ].join("\n");

  assert.equal(extractTextFromJsonEvents(output), "```json\n{\"ok\":true}\n```");
});

test("joins multiple text events from opencode JSON output", () => {
  const output = [
    JSON.stringify({ type: "text", part: { type: "text", text: "first" } }),
    JSON.stringify({ type: "text", part: { type: "text", text: "second" } }),
  ].join("\n");

  assert.equal(extractTextFromJsonEvents(output), "first\nsecond");
});

test("keeps empty JSON event output unchanged", () => {
  const output = JSON.stringify({ type: "step_finish", part: { reason: "stop" } });

  assert.equal(extractTextFromJsonEvents(output), output);
});

test("falls back to raw output when stdout is not JSON events", () => {
  const output = "plain stdout";

  assert.equal(extractTextFromJsonEvents(output), output);
});

test("maps opencode JSON events to progress entries", () => {
  assert.deepEqual(toOpencodeProgressEntry({ type: "step_start" }), {
    type: "step_start",
    stream: "opencode",
    message: "开始运行 opencode",
    terminalLine: "opencode: step_start",
  });
  assert.deepEqual(toOpencodeProgressEntry({ type: "text" }), {
    type: "text",
    stream: "opencode",
    message: "收到模型输出",
    terminalLine: "opencode: text",
  });
  assert.deepEqual(toOpencodeProgressEntry({ type: "step_finish", part: { reason: "stop" } }), {
    type: "step_finish",
    stream: "opencode",
    message: "运行结束：stop",
    terminalLine: "opencode: step_finish stop",
  });
});

test("extracts session id from opencode JSON event variants", () => {
  assert.equal(
    findSessionIdInJsonEvents(JSON.stringify({ session: { id: "session:nested" } })),
    "session:nested",
  );
  assert.equal(
    findSessionIdInJsonEvents(JSON.stringify({ properties: { sessionID: "session:properties" } })),
    "session:properties",
  );
  assert.equal(findSessionIdInJsonEvents("plain stdout"), null);
});
