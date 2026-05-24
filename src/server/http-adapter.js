import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, normalize, relative } from "node:path";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const STATIC_CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendEvent(response, event) {
  response.write(`event: ${event.type}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function isInsideDirectory(parentDir, childPath) {
  const relativePath = relative(parentDir, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

export function createHttpJsonAdapter() {
  return {
    sendJson(response, status, payload) {
      response.writeHead(status, { "content-type": JSON_CONTENT_TYPE });
      response.end(JSON.stringify(payload));
    },

    async readJsonBody(request) {
      const body = await readRequestBody(request);
      if (!body.trim()) return {};
      return JSON.parse(body);
    },
  };
}

export function createHttpEventStreamAdapter() {
  return {
    serveEvents(request, response, workflowService) {
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
    },
  };
}

export function createHttpStaticFileAdapter({ publicDir }) {
  return {
    async serveStatic(request, response) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const pathname = decodeURIComponent(url.pathname);
      const requestedPath = pathname === "/" ? "/index.html" : pathname;
      const filePath = normalize(join(publicDir, requestedPath));

      if (!isInsideDirectory(publicDir, filePath)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      try {
        const body = await readFile(filePath);
        response.writeHead(200, {
          "content-type": STATIC_CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
          "cache-control": "no-store",
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
    },
  };
}

export function createHttpAdapter({ publicDir }) {
  return {
    ...createHttpJsonAdapter(),
    ...createHttpEventStreamAdapter(),
    ...createHttpStaticFileAdapter({ publicDir }),
  };
}
