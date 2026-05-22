import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTerminalSession } from "../public/workflow-terminal-renderer.js";
import { fakeElements } from "./support/fake-dom.js";

function createElements() {
  return fakeElements([
    "terminalStatus",
    "terminalOutput",
    "terminalStartButton",
    "terminalCancelButton",
    "terminalSendButton",
    "terminalInput",
  ]);
}

test("terminal renderer writes output and running controls", () => {
  const elements = createElements();

  renderTerminalSession({
    elements,
    terminalSession: {
      id: "terminal-session-1",
      status: "running",
      command: "node",
      args: ["-i"],
      startedAt: "2026-05-22T00:00:00.000Z",
      finishedAt: null,
      output: [
        {
          stream: "stdout",
          text: "\u001b[32mready\u001b[0m",
          timestamp: "2026-05-22T00:00:01.000Z",
        },
      ],
    },
  });

  assert.equal(elements.terminalStatus.textContent, "running · terminal-session-1");
  assert.match(elements.terminalOutput.textContent, /command: node -i/);
  assert.match(elements.terminalOutput.textContent, /\[stdout\] ready/);
  assert.equal(elements.terminalOutput.scrollTop, elements.terminalOutput.scrollHeight);
  assert.equal(elements.terminalStartButton.disabled, true);
  assert.equal(elements.terminalCancelButton.disabled, false);
  assert.equal(elements.terminalSendButton.disabled, false);
  assert.equal(elements.terminalInput.disabled, false);
});

test("terminal renderer handles empty terminal state", () => {
  const elements = createElements();

  renderTerminalSession({ elements, terminalSession: null });

  assert.equal(elements.terminalStatus.textContent, "未连接");
  assert.equal(elements.terminalOutput.textContent, "尚未启动终端。");
  assert.equal(elements.terminalStartButton.disabled, false);
  assert.equal(elements.terminalCancelButton.disabled, true);
  assert.equal(elements.terminalSendButton.disabled, true);
  assert.equal(elements.terminalInput.disabled, true);
});
