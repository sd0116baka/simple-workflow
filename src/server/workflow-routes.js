import { createWorkflowRouteDefinitions } from "./workflow-route-definitions.js";

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
