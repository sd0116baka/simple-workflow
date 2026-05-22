import { createWorkflowRouteDefinitions } from "./workflow-route-definitions.js";

function requestPath(request) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  return url.pathname;
}

function matchesRoute(route, { method, path }) {
  return route.path === path && (!route.method || route.method === method);
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
        await route.handle({ request, response });
        return true;
      }

      return false;
    },
  };
}
