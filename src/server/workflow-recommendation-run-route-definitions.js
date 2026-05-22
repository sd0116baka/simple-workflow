import { normalizeWorkflowStageSwitches } from "../workflow/workflow-stage-switches.js";

export function createWorkflowRecommendationRunRouteDefinitions({
  workflowService,
  httpAdapter,
}) {
  return [
    {
      method: "POST",
      path: "/api/recommendation-runs/cancel",
      async handle({ response }) {
        const result = workflowService.cancelRecommendationRun();
        httpAdapter.sendJson(response, result.cancelled ? 200 : 409, result);
      },
    },
    {
      method: "POST",
      path: "/api/recommendation-runs",
      async handle({ request, response }) {
        const currentRun = workflowService.getLatestRecommendationRun?.();
        if (currentRun?.status === "running") {
          httpAdapter.sendJson(response, 409, {
            error: "已有推荐器流程正在运行。请等待结束或先取消运行。",
            recommendationRun: currentRun,
          });
          return;
        }

        const body = request ? await httpAdapter.readJsonBody(request) : {};
        const mode = body.mode === "probe" ? "probe" : "workflow";
        const stageSwitches = normalizeWorkflowStageSwitches(body.stageSwitches);
        httpAdapter.sendJson(response, 201, {
          recommendationRun: await workflowService.createRecommendationRun({ mode, stageSwitches }),
        });
      },
    },
    {
      method: "GET",
      path: "/api/recommendation-runs/latest",
      async handle({ response }) {
        httpAdapter.sendJson(response, 200, {
          recommendationRun: workflowService.getLatestRecommendationRun(),
        });
      },
    },
  ];
}
