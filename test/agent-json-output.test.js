import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAgentJsonOutputText } from "../src/workflow/agent-json-output.js";

test("agent json output extracts a full fenced JSON response", () => {
  assert.equal(
    extractAgentJsonOutputText([
      "```json",
      "{\"ok\":true}",
      "```",
    ].join("\n")),
    "{\"ok\":true}",
  );
});

test("agent json output keeps surrounding text unless embedded fences are allowed", () => {
  const output = [
    "Agent summary",
    "```json",
    "{\"ok\":true}",
    "```",
  ].join("\n");

  assert.equal(extractAgentJsonOutputText(output), output);
  assert.equal(
    extractAgentJsonOutputText(output, { allowEmbeddedFence: true }),
    "{\"ok\":true}",
  );
});

test("agent json output falls back to trimmed raw text without a fence", () => {
  assert.equal(extractAgentJsonOutputText("  {\"ok\":true}  "), "{\"ok\":true}");
  assert.equal(extractAgentJsonOutputText(null), "");
});
