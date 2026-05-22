const READ_ROUTE_PROJECTIONS = [
  {
    path: "/api/task-pool",
    payloadKey: "taskPool",
    read(workflowService) {
      return workflowService.listTaskPool();
    },
  },
  {
    path: "/api/startup-check",
    payloadKey: "startupCheck",
    read(workflowService) {
      return workflowService.getStartupCheck();
    },
  },
  {
    path: "/api/tasks",
    payloadKey: "tasks",
    read(workflowService) {
      return workflowService.listTasks();
    },
  },
];

export function createWorkflowReadRouteDefinitions({
  workflowService,
  httpAdapter,
}) {
  return READ_ROUTE_PROJECTIONS.map(({ path, payloadKey, read }) => ({
    method: "GET",
    path,
    async handle({ response }) {
      httpAdapter.sendJson(response, 200, {
        [payloadKey]: await read(workflowService),
      });
    },
  }));
}
