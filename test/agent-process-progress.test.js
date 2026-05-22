import { test } from "node:test";
import assert from "node:assert/strict";
import { createAgentProcessProgressEntries } from "../src/workflow/agent-process-progress.js";

test("agent process progress entries build default process events", () => {
  const entries = createAgentProcessProgressEntries();

  assert.deepEqual(entries.start({
    commandLine: "node worker.js",
    cwd: "D:\\Project\\simple-workflow",
    pid: 1234,
  }), {
    type: "process_start",
    stream: "system",
    message: "启动进程：node worker.js",
    terminalLine: "$ node worker.js\ncwd: D:\\Project\\simple-workflow\npid: 1234",
  });
  assert.deepEqual(entries.heartbeat({ idleSeconds: 10 }), {
    type: "heartbeat",
    stream: "system",
    message: "进程仍在运行，10s 无新输出",
    terminalLine: "process: still running, no output for 10s",
  });
  assert.deepEqual(entries.cancelled(), {
    type: "process_cancelled",
    stream: "system",
    message: "用户取消运行",
    terminalLine: "process: cancelled by user",
  });
  assert.deepEqual(entries.stdout({ chunk: "hello\n" }), {
    type: "stdout",
    stream: "stdout",
    message: "stdout 6 chars",
    terminalLine: "hello",
  });
});

test("agent process progress entries build scoped execution events", () => {
  const entries = createAgentProcessProgressEntries({
    typePrefix: "execution_",
    systemStream: "execution-agent",
    stdoutStream: "execution-stdout",
    stderrStream: "execution-stderr",
    subject: "execution-agent:001",
  });

  assert.deepEqual(entries.start({
    commandLine: "opencode run --format json",
    cwd: "D:\\Project\\simple-workflow\\.workflow\\worktrees\\task-001",
    pid: null,
  }), {
    type: "execution_process_start",
    stream: "execution-agent",
    message: "启动 execution-agent:001：opencode run --format json",
    terminalLine: "$ opencode run --format json\ncwd: D:\\Project\\simple-workflow\\.workflow\\worktrees\\task-001\nrunId: execution-agent:001\npid: unknown",
  });
  assert.deepEqual(entries.stderr({ chunk: "warning\n" }), {
    type: "execution_stderr",
    stream: "execution-stderr",
    message: "execution-agent:001 stderr 8 chars",
    terminalLine: "warning",
  });
  assert.deepEqual(entries.error({ error: new Error("missing binary") }), {
    type: "execution_process_error",
    stream: "execution-agent",
    message: "execution-agent:001 启动失败：missing binary",
    terminalLine: "execution-agent:001: error missing binary",
  });
  assert.deepEqual(entries.close({ exitCode: 0 }), {
    type: "execution_process_close",
    stream: "execution-agent",
    message: "execution-agent:001 退出：0",
    terminalLine: "execution-agent:001: exited with code 0",
  });
});

test("agent process progress entries truncate long terminal output", () => {
  const entries = createAgentProcessProgressEntries();
  const output = "a".repeat(4002);

  assert.equal(
    entries.stdout({ chunk: output }).terminalLine,
    `${"a".repeat(4000)}\n...[truncated 2 chars]`,
  );
});
