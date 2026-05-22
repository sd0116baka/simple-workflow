import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDirectRun, startDirectRunServer } from "../src/server/server-direct-run.js";

test("direct run lifecycle starts watching, listens, and logs runtime paths", async () => {
  const calls = [];
  const runtimeConfig = {
    repositoryDir: "D:\\Project\\simple-workflow\\.workflow\\test-environment\\repository",
    tasksDir: "D:\\Project\\simple-workflow\\.workflow\\test-environment\\repository\\tasks",
  };
  const workflowService = {
    async startWatching() {
      calls.push("startWatching");
    },
    stopWatching() {
      calls.push("stopWatching");
    },
  };
  const fakeServer = {
    listen(port, callback) {
      calls.push(`listen:${port}`);
      callback();
      return this;
    },
  };
  const logs = [];

  const result = await startDirectRunServer({
    runtimeConfig,
    workflowService,
    port: 5173,
    createServerApp({ workflowService: injectedService, restartServer }) {
      assert.equal(injectedService, workflowService);
      assert.equal(typeof restartServer, "function");
      calls.push("createApp");
      return fakeServer;
    },
    log(message) {
      logs.push(message);
    },
  });

  assert.equal(result.server, fakeServer);
  assert.deepEqual(calls, ["startWatching", "createApp", "listen:5173"]);
  assert.deepEqual(logs, [
    "simple-workflow running at http://localhost:5173",
    `workflow repository: ${runtimeConfig.repositoryDir}`,
    `workflow tasks: ${runtimeConfig.tasksDir}`,
  ]);
});

test("direct run restart launches replacement and closes the current server", async () => {
  const calls = [];
  const workflowService = {
    async startWatching() {
      calls.push("startWatching");
    },
    stopWatching() {
      calls.push("stopWatching");
    },
  };
  const fakeServer = {
    listen() {
      calls.push("listen");
      return this;
    },
    close(callback) {
      calls.push("close");
      callback();
    },
    closeAllConnections() {
      calls.push("closeAllConnections");
    },
  };
  const restartCalls = [];
  const exitCodes = [];

  const result = await startDirectRunServer({
    runtimeConfig: {
      repositoryDir: "repo",
      tasksDir: "tasks",
    },
    workflowService,
    port: 5173,
    createServerApp() {
      return fakeServer;
    },
    startRestartProcess(options) {
      restartCalls.push(options);
      calls.push("restartProcess");
    },
    currentPid: 1234,
    cwd: "D:\\Project\\simple-workflow",
    nodePath: "C:\\Program Files\\nodejs\\node.exe",
    serverPath: "D:\\Project\\simple-workflow\\src\\server\\server.js",
    platform: "win32",
    restartDelayMs: 250,
    setRestartTimeout(callback, delayMs) {
      calls.push(`timeout:${delayMs}`);
      callback();
    },
    exitProcess(code) {
      calls.push(`exit:${code}`);
      exitCodes.push(code);
    },
    log() {},
  });

  result.restartServer();

  assert.deepEqual(restartCalls, [
    {
      currentPid: 1234,
      cwd: "D:\\Project\\simple-workflow",
      nodePath: "C:\\Program Files\\nodejs\\node.exe",
      serverPath: "D:\\Project\\simple-workflow\\src\\server\\server.js",
      platform: "win32",
    },
  ]);
  assert.deepEqual(exitCodes, [0]);
  assert.deepEqual(calls, [
    "startWatching",
    "listen",
    "timeout:250",
    "restartProcess",
    "stopWatching",
    "close",
    "exit:0",
    "closeAllConnections",
  ]);
});

test("detects direct execution from a Windows-style argv path", () => {
  const scriptPath = join(process.cwd(), "src", "server", "server.js");
  const moduleUrl = pathToFileURL(scriptPath).href;

  assert.equal(isDirectRun(moduleUrl, scriptPath), true);
});
