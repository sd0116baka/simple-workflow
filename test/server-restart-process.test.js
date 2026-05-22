import { test } from "node:test";
import assert from "node:assert/strict";
import { restartCommand } from "../src/server/server-restart-process.js";

test("restart command waits for the current Windows process before starting node", () => {
  const command = restartCommand({
    currentPid: 1234,
    cwd: "D:\\Project\\simple-workflow",
    nodePath: "C:\\Program Files\\nodejs\\node.exe",
    serverPath: "D:\\Project\\simple-workflow\\src\\server\\server.js",
    platform: "win32",
  });

  assert.equal(command.command, "powershell.exe");
  assert.deepEqual(command.args.slice(0, 3), [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
  ]);
  assert.match(command.args.at(-1), /Wait-Process -Id 1234/);
  assert.match(command.args.at(-1), /node\.exe/);
  assert.match(command.args.at(-1), /src\\server\\server\.js/);
  assert.match(command.args.at(-1), /Start-Process/);
  assert.match(command.args.at(-1), /Set-Location/);
  assert.doesNotMatch(command.args.at(-1), /npm/);
});

test("restart command uses a detached shell launcher on non-Windows platforms", () => {
  const command = restartCommand({
    currentPid: 5678,
    cwd: "/workspace/simple-workflow",
    nodePath: "/usr/local/bin/node",
    serverPath: "/workspace/simple-workflow/src/server/server.js",
    platform: "linux",
  });

  assert.equal(command.command, "sh");
  assert.deepEqual(command.args.slice(0, 3), [
    "-c",
    "while kill -0 5678 2>/dev/null; do sleep 0.2; done; cd \"$1\"; nohup \"$2\" \"$3\" >/dev/null 2>&1 &",
    "simple-workflow-restart",
  ]);
  assert.equal(command.args[3], "/workspace/simple-workflow");
  assert.equal(command.args[4], "/usr/local/bin/node");
  assert.equal(command.args[5], "/workspace/simple-workflow/src/server/server.js");
});
