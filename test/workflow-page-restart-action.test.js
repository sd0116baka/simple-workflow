import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resetRestartControls,
  restartServerAction,
  waitForServerReady,
} from "../public/workflow-page-restart-action.js";

class FakeButton {
  constructor(textContent = "") {
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.textContent = textContent;
  }
}

test("wait for server ready retries failed and unavailable probes", async () => {
  const sleeps = [];
  const calls = [];
  let probeCount = 0;
  const workflowApi = {
    async probeStartupCheck() {
      calls.push(["probeStartupCheck"]);
      probeCount += 1;
      if (probeCount === 1) throw new Error("server down");
      return { ok: probeCount > 2 };
    },
  };

  await waitForServerReady({
    workflowApi,
    sleepFn: async (delay) => sleeps.push(delay),
  });

  assert.deepEqual(sleeps, [500, 500, 500]);
  assert.deepEqual(calls, [
    ["probeStartupCheck"],
    ["probeStartupCheck"],
    ["probeStartupCheck"],
  ]);
});

test("wait for server ready reports timeout after all attempts", async () => {
  await assert.rejects(
    () => waitForServerReady({
      workflowApi: {
        async probeStartupCheck() {
          return { ok: false };
        },
      },
      sleepFn: async () => {},
      attemptCount: 2,
    }),
    /服务重启超时/,
  );
});

test("restart server action coordinates feedback, readiness, and page refresh", async () => {
  const calls = [];
  const sleeps = [];
  let probeCount = 0;
  const restartButton = new FakeButton("重启");
  const refreshButton = new FakeButton("刷新");
  const workflowApi = {
    async restartServer() {
      calls.push(["restartServer"]);
    },
    async probeStartupCheck() {
      calls.push(["probeStartupCheck"]);
      probeCount += 1;
      return { ok: probeCount > 1 };
    },
  };

  await restartServerAction({
    workflowApi,
    restartButton,
    refreshButton,
    refreshPage: async () => calls.push(["refreshPage"]),
    sleepFn: async (delay) => sleeps.push(delay),
  });

  assert.deepEqual(sleeps, [1000, 500, 500]);
  assert.deepEqual(calls, [
    ["restartServer"],
    ["probeStartupCheck"],
    ["probeStartupCheck"],
    ["refreshPage"],
  ]);
  assert.equal(restartButton.disabled, false);
  assert.equal(refreshButton.disabled, false);
  assert.equal(restartButton.textContent, "重启");
});

test("reset restart controls restores both buttons", () => {
  const restartButton = new FakeButton("重启中");
  const refreshButton = new FakeButton("刷新");
  restartButton.disabled = true;
  refreshButton.disabled = true;

  resetRestartControls({ restartButton, refreshButton });

  assert.equal(restartButton.disabled, false);
  assert.equal(refreshButton.disabled, false);
  assert.equal(restartButton.textContent, "重启");
});
