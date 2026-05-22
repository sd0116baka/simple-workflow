import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, normalize, relative } from "node:path";

const STATIC_CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function isInsideDirectory(parentDir, childPath) {
  const relativePath = relative(parentDir, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
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
