import { createServer } from "node:http";
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
  workflowService = createWorkflowService({ tasksDir }),
} = {}) {
  return createServer(async (request, response) => {
    try {
      if (request.url?.startsWith("/api/events")) {
        serveEvents(request, response, workflowService);
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

if (isDirectRun(import.meta.url, process.argv[1])) {
  const workflowService = createWorkflowService({ tasksDir });
  await workflowService.startWatching();
  createApp({ workflowService }).listen(port, () => {
    console.log(`simple-workflow running at http://localhost:${port}`);
  });
}
