export function createWorkflowServerControlRouteDefinitions({
  restartServer = null,
  httpAdapter,
}) {
  return [
    {
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
    },
  ];
}
