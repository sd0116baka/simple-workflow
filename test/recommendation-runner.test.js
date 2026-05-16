import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTextFromJsonEvents } from "../src/workflow/recommendation-runner.js";

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
