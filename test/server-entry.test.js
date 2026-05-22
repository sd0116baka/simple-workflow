import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDirectRun } from "../src/server/server-direct-run.js";
import { runtimeConfigFromEnv, serverPortFromEnv } from "../src/server/server-runtime-config.js";

test("detects direct execution from a Windows-style argv path", () => {
  const scriptPath = join(process.cwd(), "src", "server", "server.js");
  const moduleUrl = pathToFileURL(scriptPath).href;

  assert.equal(isDirectRun(moduleUrl, scriptPath), true);
});

test("builds workflow runtime config from environment paths", () => {
  const config = runtimeConfigFromEnv({
    SIMPLE_WORKFLOW_REPOSITORY_DIR: "D:\\Project\\simple-workflow\\.workflow\\test-environment\\repository",
    SIMPLE_WORKFLOW_TASKS_DIR: "D:\\Project\\simple-workflow\\.workflow\\test-environment\\repository\\tasks",
    SIMPLE_WORKFLOW_CONTEXT_STORE_DIR: "D:\\Project\\simple-workflow\\.workflow\\test-environment\\repository\\.workflow\\task-context-packages",
  }, "D:\\Project\\simple-workflow");

  assert.equal(config.repositoryDir, "D:\\Project\\simple-workflow\\.workflow\\test-environment\\repository");
  assert.equal(config.tasksDir, "D:\\Project\\simple-workflow\\.workflow\\test-environment\\repository\\tasks");
  assert.equal(
    config.taskContextPackageStoreDir,
    "D:\\Project\\simple-workflow\\.workflow\\test-environment\\repository\\.workflow\\task-context-packages",
  );
});

test("builds server port from environment with the default management port", () => {
  assert.equal(serverPortFromEnv({}), 5173);
  assert.equal(serverPortFromEnv({ PORT: "6182" }), 6182);
});
