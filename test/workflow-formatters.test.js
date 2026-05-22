import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatElapsed,
  formatJsonBlock,
  formatProgress,
  formatTerminalProgress,
  stripAnsi,
} from "../public/workflow-formatters.js";

test("workflow formatters normalize terminal output and elapsed time", () => {
  assert.equal(stripAnsi("\u001b[31mfailed\u001b[0m"), "failed");
  assert.equal(
    formatElapsed("2026-05-21T10:00:00.000Z", "2026-05-21T10:02:05.000Z"),
    "02:05",
  );
  assert.equal(
    formatElapsed("2026-05-21T10:00:00.000Z", null, () => new Date("2026-05-21T10:00:09.000Z").getTime()),
    "00:09",
  );
  assert.equal(formatElapsed("bad-date"), "--:--");
});

test("workflow formatters render recommendation progress blocks", () => {
  assert.equal(formatProgress([{ message: "启动" }]), "--:--:-- 启动");
  assert.equal(formatTerminalProgress(null), "尚未启动进程。");

  const terminal = formatTerminalProgress({
    id: "recommendation-run:001",
    status: "succeeded",
    startedAt: "2026-05-21T10:00:00.000Z",
    finishedAt: "2026-05-21T10:00:03.000Z",
    command: "opencode",
    args: ["run", "--format", "json"],
    progress: [
      {
        stream: "stdout",
        terminalLine: "\u001b[32mhello\u001b[0m",
      },
    ],
  });

  assert.match(terminal, /recommendation-run:001/);
  assert.match(terminal, /opencode run --format json/);
  assert.match(terminal, /\[stdout\] hello/);
});

test("workflow formatters render JSON blocks", () => {
  assert.equal(formatJsonBlock(null), "未生成。");
  assert.equal(formatJsonBlock({ ok: true }), "{\n  \"ok\": true\n}");
});
