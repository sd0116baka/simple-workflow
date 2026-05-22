import { fileURLToPath, pathToFileURL } from "node:url";
import { createWorkflowService } from "../workflow/workflow-service.js";
import { createApp } from "./server-app.js";
import { spawnRestartProcess } from "./server-restart-process.js";
import { rootDir, runtimeConfigFromEnv, serverPortFromEnv } from "./server-runtime-config.js";

export function isDirectRun(moduleUrl, argvPath) {
  return argvPath ? moduleUrl === pathToFileURL(argvPath).href : false;
}

export async function startDirectRunServer({
  runtimeConfig = runtimeConfigFromEnv(),
  workflowService = createWorkflowService(runtimeConfig),
  port = serverPortFromEnv(),
  createServerApp = createApp,
  startRestartProcess = spawnRestartProcess,
  currentPid = process.pid,
  cwd = rootDir,
  nodePath = process.execPath,
  serverPath = fileURLToPath(new URL("server.js", import.meta.url)),
  platform = process.platform,
  restartDelayMs = 250,
  setRestartTimeout = setTimeout,
  exitProcess = process.exit,
  log = console.log,
} = {}) {
  await workflowService.startWatching();
  let server = null;
  const restartServer = () => {
    setRestartTimeout(() => {
      startRestartProcess({
        currentPid,
        cwd,
        nodePath,
        serverPath,
        platform,
      });
      workflowService.stopWatching();
      server.close(() => {
        exitProcess(0);
      });
      server.closeAllConnections?.();
    }, restartDelayMs);
  };

  server = createServerApp({ workflowService, restartServer }).listen(port, () => {
    log(`simple-workflow running at http://localhost:${port}`);
    log(`workflow repository: ${runtimeConfig.repositoryDir}`);
    log(`workflow tasks: ${runtimeConfig.tasksDir}`);
  });

  return {
    port,
    restartServer,
    runtimeConfig,
    server,
    workflowService,
  };
}
