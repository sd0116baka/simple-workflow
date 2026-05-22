function terminalRouteErrorStatus(error) {
  return /not found/i.test(error.message) ? 404 : 400;
}

export function createWorkflowTerminalSessionRouteDefinitions({
  workflowService,
  httpAdapter,
}) {
  return [
    {
      method: "POST",
      path: "/api/terminal-sessions",
      async handle({ request, response }) {
        try {
          const body = await httpAdapter.readJsonBody(request);
          const terminalSession = workflowService.createTerminalSession(body);
          httpAdapter.sendJson(response, 201, { terminalSession });
        } catch (error) {
          httpAdapter.sendJson(response, terminalRouteErrorStatus(error), {
            error: error.message,
          });
        }
      },
    },
    {
      method: "GET",
      path: "/api/terminal-sessions/latest",
      async handle({ response }) {
        httpAdapter.sendJson(response, 200, {
          terminalSession: workflowService.getLatestTerminalSession(),
        });
      },
    },
    {
      method: "POST",
      path: "/api/terminal-sessions/input",
      async handle({ request, response }) {
        try {
          const body = await httpAdapter.readJsonBody(request);
          const terminalSession = workflowService.writeTerminalSessionInput(body);
          httpAdapter.sendJson(response, 200, { terminalSession });
        } catch (error) {
          httpAdapter.sendJson(response, terminalRouteErrorStatus(error), {
            error: error.message,
          });
        }
      },
    },
    {
      method: "POST",
      path: "/api/terminal-sessions/cancel",
      async handle({ request, response }) {
        try {
          const body = await httpAdapter.readJsonBody(request);
          const terminalSession = workflowService.cancelTerminalSession(body);
          httpAdapter.sendJson(response, 200, { terminalSession });
        } catch (error) {
          httpAdapter.sendJson(response, terminalRouteErrorStatus(error), {
            error: error.message,
          });
        }
      },
    },
  ];
}
