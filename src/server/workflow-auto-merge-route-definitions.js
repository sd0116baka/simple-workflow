const AUTO_MERGE_ROUTE_PROJECTIONS = [
  {
    method: "POST",
    path: "/api/auto-merge/replan",
    inputFromBody(body) {
      return {
        packageId: body.packageId,
      };
    },
    async run(workflowService, input) {
      return workflowService.replanAutoMerge(input);
    },
    statusFromResult(result) {
      return result.error ? 409 : 200;
    },
  },
];

export function createWorkflowAutoMergeRouteDefinitions({
  workflowService,
  httpAdapter,
}) {
  return AUTO_MERGE_ROUTE_PROJECTIONS.map(
    ({ method, path, inputFromBody, run, statusFromResult }) => ({
      method,
      path,
      async handle({ request, response }) {
        const body = await httpAdapter.readJsonBody(request);
        const result = await run(workflowService, inputFromBody(body));
        httpAdapter.sendJson(response, statusFromResult(result), result);
      },
    }),
  );
}
