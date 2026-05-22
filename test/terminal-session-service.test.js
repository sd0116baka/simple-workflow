import { test } from "node:test";
import assert from "node:assert/strict";
import { createTerminalSessionService } from "../src/workflow/terminal-session-service.js";

function waitFor(predicate, { timeoutMs = 3000 } = {}) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        reject(new Error("waitFor timed out"));
      }
    }, 20);
  });
}

test("terminal session service runs an interactive process and records input/output", async () => {
  const events = [];
  const service = createTerminalSessionService({
    repositoryDir: process.cwd(),
    shell: false,
    emitTerminalSessionChanged: (session) => events.push(session),
  });

  const terminalSession = service.createTerminalSession({
    command: process.execPath,
    args: [
      "-e",
      [
        "process.stdin.setEncoding('utf8');",
        "console.log('ready');",
        "process.stdin.on('data', (chunk) => {",
        "process.stdout.write(`echo:${chunk}`);",
        "if (chunk.includes('quit')) process.exit(0);",
        "});",
      ].join(""),
    ],
  });

  await waitFor(() =>
    service.getTerminalSession({ sessionId: terminalSession.id })
      .output.some((entry) => entry.text.includes("ready")));

  const afterInput = service.writeTerminalSessionInput({
    sessionId: terminalSession.id,
    input: "quit\n",
  });

  assert.equal(afterInput.status, "running");
  assert.equal(afterInput.output.some((entry) => entry.stream === "stdin"), true);

  await waitFor(() =>
    service.getTerminalSession({ sessionId: terminalSession.id }).status === "exited");

  const finished = service.getLatestTerminalSession();
  assert.equal(finished.id, terminalSession.id);
  assert.equal(finished.exitCode, 0);
  assert.equal(finished.output.some((entry) => entry.text.includes("echo:quit")), true);
  assert.equal(events.some((event) => event.status === "exited"), true);
});

test("terminal session service rejects missing sessions and inactive input", async () => {
  const service = createTerminalSessionService({ shell: false });
  assert.throws(
    () => service.writeTerminalSessionInput({ sessionId: "missing", input: "x" }),
    /not found/,
  );

  const terminalSession = service.createTerminalSession({
    command: process.execPath,
    args: ["-e", "process.exit(0)"],
  });
  await waitFor(() =>
    service.getTerminalSession({ sessionId: terminalSession.id }).status === "exited");

  assert.throws(
    () => service.writeTerminalSessionInput({ sessionId: terminalSession.id, input: "x" }),
    /not running/,
  );
});
