import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateTerminalLine } from "../src/workflow/terminal-output.js";

test("leaves short terminal lines unchanged", () => {
  assert.equal(truncateTerminalLine("short", 10), "short");
});

test("truncates long terminal lines with omitted character count", () => {
  assert.equal(truncateTerminalLine("abcdef", 3), "abc\n...[truncated 3 chars]");
});

test("normalizes nullish terminal values to an empty string", () => {
  assert.equal(truncateTerminalLine(null, 3), "");
  assert.equal(truncateTerminalLine(undefined, 3), "");
});
