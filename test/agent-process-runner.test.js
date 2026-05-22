import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgentProcess } from "../src/workflow/agent-process-runner.js";

test("agent process runner writes prompt and collects output", async () => {
  const progress = [];
  const script = [
    "const chunks = [];",
    "process.stdin.on('data', (chunk) => chunks.push(chunk));",
    "process.stdin.on('end', () => {",
    "  process.stdout.write('stdout:' + Buffer.concat(chunks).toString());",
    "  process.stderr.write('stderr text');",
    "});",
  ].join("");

  const result = await runAgentProcess({
    command: process.execPath,
    args: ["-e", script],
    shell: false,
    prompt: "hello prompt",
    onProgress: (entry) => progress.push(entry),
  });

  assert.equal(result.stdout, "stdout:hello prompt");
  assert.equal(result.stderr, "stderr text");
  assert.equal(result.exitCode, 0);
  assert.equal(result.error, null);
  assert.equal(result.cancelled, false);
  assert.equal(progress[0].type, "process_start");
  assert.equal(progress.some((entry) => entry.type === "stdout"), true);
  assert.equal(progress.some((entry) => entry.type === "stderr"), true);
  assert.equal(progress.at(-1).type, "process_close");
});

test("agent process runner resolves cancelled without spawning when signal already aborted", async () => {
  const controller = new AbortController();
  controller.abort();

  const result = await runAgentProcess({
    command: process.execPath,
    args: ["-e", "throw new Error('should not run')"],
    signal: controller.signal,
  });

  assert.deepEqual(result, {
    stdout: "",
    stderr: "",
    exitCode: null,
    error: "cancelled",
    cancelled: true,
  });
});
