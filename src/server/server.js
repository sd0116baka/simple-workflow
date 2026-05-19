import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createWorkflowService } from "../workflow/workflow-service.js";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));
const publicDir = join(rootDir, "public");
const tasksDir = join(rootDir, "tasks");
const port = Number(process.env.PORT ?? 5173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": contentTypes[".json"] });
  response.end(JSON.stringify(payload));
}

function sendEvent(response, event) {
  response.write(`event: ${event.type}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function serveEvents(request, response, workflowService) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  response.write(": connected\n\n");

  const unsubscribe = workflowService.onEvent((event) => {
    sendEvent(response, event);
  });

  request.on("close", unsubscribe);
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(publicDir, requestedPath));

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    });
    response.end(body);
  } catch (error) {
    if (error?.code === "ENOENT") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    throw error;
  }
}

export function createApp({
  workflowService = createWorkflowService({ tasksDir, repositoryDir: rootDir }),
  restartServer = null,
} = {}) {
  return createServer(async (request, response) => {
    try {
      if (request.url?.startsWith("/api/events")) {
        serveEvents(request, response, workflowService);
        return;
      }

      if (request.method === "POST" && request.url?.startsWith("/api/recommendation-runs")) {
        sendJson(response, 201, { recommendationRun: await workflowService.createRecommendationRun() });
        return;
      }

      if (request.method === "POST" && request.url?.startsWith("/api/human-decisions/accept-completion")) {
        const result = await workflowService.acceptTaskCompletion();
        sendJson(response, result.accepted ? 200 : 409, result);
        return;
      }

      if (request.method === "POST" && request.url?.startsWith("/api/server/restart")) {
        if (!restartServer) {
          sendJson(response, 501, { error: "Server restart is not available." });
          return;
        }
        sendJson(response, 202, { restarting: true });
        restartServer();
        return;
      }

      if (request.method === "GET" && request.url?.startsWith("/api/recommendation-runs/latest")) {
        sendJson(response, 200, { recommendationRun: workflowService.getLatestRecommendationRun() });
        return;
      }

      if (request.url?.startsWith("/api/task-pool")) {
        sendJson(response, 200, { taskPool: await workflowService.listTaskPool() });
        return;
      }

      if (request.url?.startsWith("/api/startup-check")) {
        sendJson(response, 200, { startupCheck: await workflowService.getStartupCheck() });
        return;
      }

      if (request.url?.startsWith("/api/tasks")) {
        sendJson(response, 200, { tasks: await workflowService.listTasks() });
        return;
      }

      await serveStatic(request, response);
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: "Internal server error" });
    }
  });
}

export function isDirectRun(moduleUrl, argvPath) {
  return argvPath ? moduleUrl === pathToFileURL(argvPath).href : false;
}

function quotePowerShellSingle(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function restartCommand({
  currentPid = process.pid,
  cwd = rootDir,
  nodePath = process.execPath,
  serverPath = fileURLToPath(import.meta.url),
  platform = process.platform,
} = {}) {
  if (platform === "win32") {
    const restartScript = [
      "$ErrorActionPreference = 'Stop'",
      `Wait-Process -Id ${currentPid} -ErrorAction SilentlyContinue`,
      "Start-Sleep -Milliseconds 300",
      `Set-Location ${quotePowerShellSingle(cwd)}`,
      `& ${quotePowerShellSingle(nodePath)} ${quotePowerShellSingle(serverPath)}`,
    ].join("; ");
    const launcherScript = [
      "Start-Process",
      `-FilePath ${quotePowerShellSingle("powershell.exe")}`,
      `-ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ${quotePowerShellSingle(restartScript)})`,
      "-WindowStyle Hidden",
    ].join(" ");
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", launcherScript],
    };
  }

  const script = [
    `while kill -0 ${currentPid} 2>/dev/null; do sleep 0.2; done`,
    `cd "$1"`,
    `nohup "$2" "$3" >/dev/null 2>&1 &`,
  ].join("; ");
  return {
    command: "sh",
    args: ["-c", script, "simple-workflow-restart", cwd, nodePath, serverPath],
  };
}

function spawnRestartProcess(options) {
  const { command, args } = restartCommand(options);
  if ((options.platform ?? process.platform) === "win32") {
    spawnSync(command, args, {
      cwd: options.cwd,
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  spawn(command, args, {
    cwd: options.cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  const workflowService = createWorkflowService({ tasksDir, repositoryDir: rootDir });
  await workflowService.startWatching();
  let server = null;
  const restartServer = () => {
    setTimeout(() => {
      spawnRestartProcess({
        currentPid: process.pid,
        cwd: rootDir,
        nodePath: process.execPath,
        serverPath: fileURLToPath(import.meta.url),
        platform: process.platform,
      });
      workflowService.stopWatching();
      server.close(() => {
        process.exit(0);
      });
      server.closeAllConnections?.();
    }, 250);
  };
  server = createApp({ workflowService, restartServer }).listen(port, () => {
    console.log(`simple-workflow running at http://localhost:${port}`);
  });
}
