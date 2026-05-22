import { createWorkflowAutoMergeRouteDefinitions } from "./workflow-auto-merge-route-definitions.js";
import { createWorkflowEventRouteDefinitions } from "./workflow-event-route-definitions.js";
import { createWorkflowManualActionRouteDefinitions } from "./workflow-manual-action-route-definitions.js";
import { createWorkflowRecommendationRunRouteDefinitions } from "./workflow-recommendation-run-route-definitions.js";
import { createWorkflowReadRouteDefinitions } from "./workflow-read-route-definitions.js";
import { createWorkflowServerControlRouteDefinitions } from "./workflow-server-control-route-definitions.js";
import { createWorkflowTestFixtureRouteDefinitions } from "./workflow-test-fixture-route-definitions.js";

export function createWorkflowRouteDefinitions({
  workflowService,
  restartServer = null,
  httpAdapter,
}) {
  return [
    ...createWorkflowEventRouteDefinitions({ workflowService, httpAdapter }),
    ...createWorkflowRecommendationRunRouteDefinitions({ workflowService, httpAdapter }),
    ...createWorkflowManualActionRouteDefinitions({ workflowService, httpAdapter }),
    ...createWorkflowAutoMergeRouteDefinitions({ workflowService, httpAdapter }),
    ...createWorkflowServerControlRouteDefinitions({ restartServer, httpAdapter }),
    ...createWorkflowTestFixtureRouteDefinitions({ workflowService, httpAdapter }),
    ...createWorkflowReadRouteDefinitions({ workflowService, httpAdapter }),
  ];
}
