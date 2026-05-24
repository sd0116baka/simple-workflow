import { createWorkflowAutoMergeRouteDefinitions } from "./workflow-auto-merge-route-definitions.js";
import { createWorkflowManualActionRouteDefinitions } from "./workflow-manual-action-route-definitions.js";
import { createWorkflowRecommendationRunRouteDefinitions } from "./workflow-recommendation-run-route-definitions.js";
import { createWorkflowReadRouteDefinitions } from "./workflow-read-route-definitions.js";
import { createWorkflowTaskDraftRouteDefinitions } from "./workflow-task-draft-route-definitions.js";
import { createWorkflowTerminalSessionRouteDefinitions } from "./workflow-terminal-session-route-definitions.js";
import { createWorkflowTestFixtureRouteDefinitions } from "./workflow-test-fixture-route-definitions.js";

function requestPath(request) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  return url.pathname;
}

function matchesRoute(route, { method, path }) {
  if (route.method && route.method !== method) return false;
  return Boolean(routeParams(route.path, path));
}

function routeParams(routePath, requestPathValue) {
  if (routePath === requestPathValue) return {};
  const routeParts = routePath.split("/").filter(Boolean);
  const requestParts = requestPathValue.split("/").filter(Boolean);
  if (routeParts.length !== requestParts.length) return null;

  const params = {};
  for (let index = 0; index < routeParts.length; index += 1) {
    const routePart = routeParts[index];
    const requestPart = requestParts[index];
    if (routePart.startsWith(":")) {
      params[routePart.slice(1)] = decodeURIComponent(requestPart);
    } else if (routePart !== requestPart) {
      return null;
    }
  }
  return params;
}

function eventRoute({ workflowService, httpAdapter }) {
  return {
    path: "/api/events",
    handle({ request, response }) {
      httpAdapter.serveEvents(request, response, workflowService);
    },
  };
}

function restartRoute({ restartServer = null, httpAdapter }) {
  return {
    method: "POST",
    path: "/api/server/restart",
    async handle({ response }) {
      if (!restartServer) {
        httpAdapter.sendJson(response, 501, { error: "Server restart is not available." });
        return;
      }

      httpAdapter.sendJson(response, 202, { restarting: true });
      restartServer();
    },
  };
}

export function createWorkflowRouteDefinitions({
  workflowService,
  restartServer = null,
  httpAdapter,
}) {
  return [
    eventRoute({ workflowService, httpAdapter }),
    ...createWorkflowRecommendationRunRouteDefinitions({ workflowService, httpAdapter }),
    ...createWorkflowManualActionRouteDefinitions({ workflowService, httpAdapter }),
    ...createWorkflowAutoMergeRouteDefinitions({ workflowService, httpAdapter }),
    ...createWorkflowTaskDraftRouteDefinitions({ workflowService, httpAdapter }),
    ...createWorkflowTerminalSessionRouteDefinitions({ workflowService, httpAdapter }),
    restartRoute({ restartServer, httpAdapter }),
    ...createWorkflowTestFixtureRouteDefinitions({ workflowService, httpAdapter }),
    ...createWorkflowReadRouteDefinitions({ workflowService, httpAdapter }),
  ];
}

export function createWorkflowRoutes({
  workflowService,
  restartServer = null,
  httpAdapter,
}) {
  const routeDefinitions = createWorkflowRouteDefinitions({
    workflowService,
    restartServer,
    httpAdapter,
  });

  return {
    async handle(request, response) {
      const path = requestPath(request);
      const method = request.method ?? "GET";
      const route = routeDefinitions.find((definition) => matchesRoute(definition, { method, path }));

      if (route) {
        await route.handle({ request, response, params: routeParams(route.path, path) });
        return true;
      }

      return false;
    },
  };
}
