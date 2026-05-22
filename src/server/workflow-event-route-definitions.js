export function createWorkflowEventRouteDefinitions({
  workflowService,
  httpAdapter,
}) {
  return [
    {
      path: "/api/events",
      async handle({ request, response }) {
        httpAdapter.serveEvents(request, response, workflowService);
      },
    },
  ];
}
