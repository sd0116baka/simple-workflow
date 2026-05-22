const TEST_FIXTURE_ROUTE_PROJECTIONS = [
  {
    method: "POST",
    path: "/api/test-fixtures/state-stubs",
    successStatus: 201,
    async inputFromRequest({ request, httpAdapter }) {
      const body = await httpAdapter.readJsonBody(request);
      return {
        fixtureKey: body.fixtureKey,
      };
    },
    async run(workflowService, input) {
      return workflowService.seedTestStateFixtures(input);
    },
  },
  {
    method: "DELETE",
    path: "/api/test-fixtures/state-stubs",
    successStatus: 200,
    async inputFromRequest() {
      return {};
    },
    async run(workflowService) {
      return workflowService.cleanupTestStateFixtures();
    },
  },
];

export function createWorkflowTestFixtureRouteDefinitions({
  workflowService,
  httpAdapter,
}) {
  return TEST_FIXTURE_ROUTE_PROJECTIONS.map(({
    method,
    path,
    successStatus,
    inputFromRequest,
    run,
  }) => ({
    method,
    path,
    async handle({ request, response }) {
      try {
        const input = await inputFromRequest({ request, httpAdapter });
        const result = await run(workflowService, input);
        httpAdapter.sendJson(response, successStatus, result);
      } catch (error) {
        httpAdapter.sendJson(response, 409, { error: error.message });
      }
    },
  }));
}
