import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageRestartCommand } from "../public/workflow-page-restart-command.js";

function createButton({ textContent = "" } = {}) {
  return {
    dataset: {},
    disabled: false,
    textContent,
  };
}

test("workflow page restart command restarts the server and refreshes the page", async () => {
  const calls = [];
  const sleeps = [];
  const elements = {
    restartButton: createButton({ textContent: "重启" }),
    refreshButton: createButton({ textContent: "刷新" }),
  };
  let probeCount = 0;
  const commands = createWorkflowPageRestartCommand({
    workflowApi: {
      async restartServer() {
        calls.push(["restartServer"]);
      },
      async probeStartupCheck() {
        calls.push(["probeStartupCheck"]);
        probeCount += 1;
        if (probeCount === 1) throw new Error("server down");
        return { ok: probeCount > 2 };
      },
    },
    refreshPage: async () => calls.push(["refreshPage"]),
    elements,
    sleepFn: async (delay) => sleeps.push(delay),
  });

  await commands.restartServer();

  assert.deepEqual(sleeps, [1000, 500, 500, 500]);
  assert.equal(elements.restartButton.disabled, false);
  assert.equal(elements.refreshButton.disabled, false);
  assert.equal(elements.restartButton.textContent, "重启");
  assert.deepEqual(calls, [
    ["restartServer"],
    ["probeStartupCheck"],
    ["probeStartupCheck"],
    ["probeStartupCheck"],
    ["refreshPage"],
  ]);
});

test("workflow page restart command preserves restart timeout failures", async () => {
  const calls = [];
  const elements = {
    restartButton: createButton({ textContent: "重启" }),
    refreshButton: createButton({ textContent: "刷新" }),
  };
  const commands = createWorkflowPageRestartCommand({
    workflowApi: {
      async restartServer() {
        calls.push(["restartServer"]);
      },
      async probeStartupCheck() {
        calls.push(["probeStartupCheck"]);
        return { ok: false };
      },
    },
    refreshPage: async () => calls.push(["refreshPage"]),
    elements,
    sleepFn: async () => {},
  });

  await assert.rejects(
    () => commands.restartServer(),
    /服务重启超时/,
  );

  assert.equal(elements.restartButton.disabled, true);
  assert.equal(elements.restartButton.textContent, "重启中");
  assert.equal(calls.filter((call) => call[0] === "probeStartupCheck").length, 30);
  assert.equal(calls.some((call) => call[0] === "refreshPage"), false);
});
