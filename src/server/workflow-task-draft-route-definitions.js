export function createWorkflowTaskDraftRouteDefinitions({
  workflowService,
  httpAdapter,
}) {
  return [
    {
      method: "POST",
      path: "/api/task-draft-assistant",
      async handle({ request, response }) {
        const body = request ? await httpAdapter.readJsonBody(request) : {};
        httpAdapter.sendJson(response, 200, {
          taskDraft: await workflowService.discussTaskSourceDraft({
            mode: body.mode,
            messages: body.messages,
          }),
        });
      },
    },
    {
      method: "POST",
      path: "/api/task-draft-assistant/task-source",
      async handle({ request, response }) {
        try {
          const body = request ? await httpAdapter.readJsonBody(request) : {};
          httpAdapter.sendJson(response, 201, {
            taskSource: await workflowService.createTaskSourceFromDraft({
              taskSourceText: body.taskSourceText,
            }),
          });
        } catch (error) {
          httpAdapter.sendJson(response, 400, {
            error: error.message,
          });
        }
      },
    },
  ];
}
