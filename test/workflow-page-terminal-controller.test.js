import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowPageTerminalController,
  parseTerminalArgs,
} from "../public/workflow-page-terminal-controller.js";
import { fakeElements } from "./support/fake-dom.js";

function createHarness() {
  const calls = [];
  const elements = fakeElements([
    "terminalCommandInput",
    "terminalArgsInput",
    "terminalInput",
  ]);
  elements.terminalCommandInput.value = "node";
  elements.terminalArgsInput.value = "-i --quiet";
  elements.terminalInput.value = "1 + 1";
  const workflowApi = {
    async loadLatestTerminalSession() {
      calls.push(["loadLatestTerminalSession"]);
      return { terminalSession: { id: "terminal-session-latest", status: "running" } };
    },
    async startTerminalSession(input) {
      calls.push(["startTerminalSession", input]);
      return { terminalSession: { id: "terminal-session-1", status: "running" } };
    },
    async writeTerminalSessionInput(input) {
      calls.push(["writeTerminalSessionInput", input]);
      return { terminalSession: { id: "terminal-session-1", status: "running" } };
    },
    async cancelTerminalSession(input) {
      calls.push(["cancelTerminalSession", input]);
      return { terminalSession: { id: "terminal-session-1", status: "cancelled" } };
    },
  };
  const terminalRenderer = {
    render(payload) {
      calls.push(["render", payload.terminalSession?.id ?? null]);
    },
  };
  const controller = createWorkflowPageTerminalController({
    workflowApi,
    elements,
    terminalRenderer,
  });
  return { calls, controller, elements };
}

test("terminal controller loads, starts, writes to, and cancels a session", async () => {
  const { calls, controller, elements } = createHarness();

  await controller.loadTerminalSession();
  await controller.startTerminalSession();
  await controller.sendTerminalInput();
  await controller.cancelTerminalSession();

  assert.equal(elements.terminalInput.value, "");
  assert.deepEqual(calls, [
    ["loadLatestTerminalSession"],
    ["render", "terminal-session-latest"],
    ["startTerminalSession", { command: "node", args: ["-i", "--quiet"] }],
    ["render", "terminal-session-1"],
    ["writeTerminalSessionInput", { sessionId: "terminal-session-1", input: "1 + 1\n" }],
    ["render", "terminal-session-1"],
    ["cancelTerminalSession", { sessionId: "terminal-session-1" }],
    ["render", "terminal-session-1"],
  ]);
});

test("terminal args parser keeps simple argv tokens", () => {
  assert.deepEqual(parseTerminalArgs("  -NoLogo   -NoProfile  "), [
    "-NoLogo",
    "-NoProfile",
  ]);
});
