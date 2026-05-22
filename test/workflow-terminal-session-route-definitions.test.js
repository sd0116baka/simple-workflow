import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowTerminalSessionRouteDefinitions } from "../src/server/workflow-terminal-session-route-definitions.js";

function createHttpAdapterProbe(body = {}) {
  const calls = [];
  return {
    calls,
    sendJson(response, status, payload) {
      calls.push({ type: "json", status, payload });
      response.sent = { status, payload };
    },
    async readJsonBody() {
      calls.push({ type: "readJsonBody" });
      return body;
    },
  };
}

test("terminal session routes start, read, write, and cancel sessions", async () => {
  const calls = [];
  const workflowService = {
    createTerminalSession(input) {
      calls.push(["createTerminalSession", input]);
      return { id: "terminal-session-1", status: "running" };
    },
    getLatestTerminalSession() {
      calls.push(["getLatestTerminalSession"]);
      return { id: "terminal-session-1", status: "running" };
    },
    writeTerminalSessionInput(input) {
      calls.push(["writeTerminalSessionInput", input]);
      return { id: "terminal-session-1", status: "running" };
    },
    cancelTerminalSession(input) {
      calls.push(["cancelTerminalSession", input]);
      return { id: "terminal-session-1", status: "cancelled" };
    },
  };

  const startAdapter = createHttpAdapterProbe({ command: "node", args: ["-i"] });
  const [startRoute, latestRoute, inputRoute, cancelRoute] = createWorkflowTerminalSessionRouteDefinitions({
    workflowService,
    httpAdapter: startAdapter,
  });
  const response = {};

  await startRoute.handle({ request: {}, response });
  assert.equal(response.sent.status, 201);

  await latestRoute.handle({ response });
  assert.equal(response.sent.payload.terminalSession.id, "terminal-session-1");

  const inputAdapter = createHttpAdapterProbe({ sessionId: "terminal-session-1", input: "1 + 1\n" });
  const [, , routedInputRoute] = createWorkflowTerminalSessionRouteDefinitions({
    workflowService,
    httpAdapter: inputAdapter,
  });
  await routedInputRoute.handle({ request: {}, response });

  const cancelAdapter = createHttpAdapterProbe({ sessionId: "terminal-session-1" });
  const [, , , routedCancelRoute] = createWorkflowTerminalSessionRouteDefinitions({
    workflowService,
    httpAdapter: cancelAdapter,
  });
  await routedCancelRoute.handle({ request: {}, response });

  assert.deepEqual(calls, [
    ["createTerminalSession", { command: "node", args: ["-i"] }],
    ["getLatestTerminalSession"],
    ["writeTerminalSessionInput", { sessionId: "terminal-session-1", input: "1 + 1\n" }],
    ["cancelTerminalSession", { sessionId: "terminal-session-1" }],
  ]);
});

test("terminal session routes map validation errors to JSON errors", async () => {
  const httpAdapter = createHttpAdapterProbe({ command: "" });
  const [route] = createWorkflowTerminalSessionRouteDefinitions({
    workflowService: {
      createTerminalSession() {
        throw new Error("command is required");
      },
    },
    httpAdapter,
  });
  const response = {};

  await route.handle({ request: {}, response });

  assert.equal(response.sent.status, 400);
  assert.equal(response.sent.payload.error, "command is required");
});
