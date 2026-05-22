import { createServer } from "node:http";
import { createWorkflowService } from "../workflow/workflow-service.js";
import { createHttpAdapter } from "./http-adapter.js";
import { publicDir, runtimeConfigFromEnv } from "./server-runtime-config.js";
import { createWorkflowRoutes } from "./workflow-routes.js";

export function createApp({
  workflowService = createWorkflowService(runtimeConfigFromEnv()),
  restartServer = null,
  httpAdapter = createHttpAdapter({ publicDir }),
  workflowRoutes = createWorkflowRoutes({ workflowService, restartServer, httpAdapter }),
  logError = console.error,
} = {}) {
  return createServer(async (request, response) => {
    try {
      if (await workflowRoutes.handle(request, response)) {
        return;
      }

      await httpAdapter.serveStatic(request, response);
    } catch (error) {
      logError(error);
      httpAdapter.sendJson(response, 500, { error: "Internal server error" });
    }
  });
}
