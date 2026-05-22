const MANUAL_ACTION_ROUTE_PROJECTIONS = [
  {
    path: "/api/human-decisions/accept-convergence",
    successKey: "accepted",
    inputFromBody(body) {
      return {
        packageId: body.packageId,
      };
    },
    async run(workflowService, input) {
      return workflowService.acceptConvergenceSuccess(input);
    },
  },
  {
    path: "/api/human-decisions/continue-convergence-with-guidance",
    successKey: "continued",
    inputFromBody(body) {
      return {
        packageId: body.packageId,
        guidance: body.guidance,
        focusAreas: body.focusAreas,
        avoidRepeating: body.avoidRepeating,
        expectedNextOutcome: body.expectedNextOutcome,
      };
    },
    async run(workflowService, input) {
      return workflowService.continueConvergenceWithGuidance(input);
    },
  },
  {
    path: "/api/human-decisions/cancel-task",
    successKey: "cancelled",
    inputFromBody(body) {
      return {
        packageId: body.packageId,
      };
    },
    async run(workflowService, input) {
      return workflowService.cancelTask(input);
    },
  },
];

export function createWorkflowManualActionRouteDefinitions({
  workflowService,
  httpAdapter,
}) {
  return MANUAL_ACTION_ROUTE_PROJECTIONS.map(({ path, successKey, inputFromBody, run }) => ({
    method: "POST",
    path,
    async handle({ request, response }) {
      const body = await httpAdapter.readJsonBody(request);
      const result = await run(workflowService, inputFromBody(body));
      httpAdapter.sendJson(response, result[successKey] ? 200 : 409, result);
    },
  }));
}
