import { createWorkflowOverviewRenderers } from "./workflow-overview-renderers.js";
import { createWorkflowPanelRenderers } from "./workflow-panel-renderers.js";
import { createWorkflowRecommendationRunRenderer } from "./workflow-recommendation-run-renderer.js";
import { createWorkflowSectionRenderer } from "./workflow-section-renderer.js";
import {
  createWorkflowOverviewRendererCallbacks,
  createWorkflowPanelRendererCallbacks,
  createWorkflowRecommendationRunRendererCallbacks,
} from "./workflow-page-shell-renderer-callbacks.js";

export function createWorkflowPageShellRendererGraph({
  getCommands,
  getDataController,
  showError,
  createOverviewRenderers = createWorkflowOverviewRenderers,
  createPanelRenderers = createWorkflowPanelRenderers,
  createRecommendationRunRenderer = createWorkflowRecommendationRunRenderer,
  createSectionRenderer = createWorkflowSectionRenderer,
} = {}) {
  const workflowPanelRenderers = createPanelRenderers({
    ...createWorkflowPanelRendererCallbacks({
      getCommands,
      showError,
    }),
  });
  const workflowOverviewRenderers = createOverviewRenderers({
    ...createWorkflowOverviewRendererCallbacks({
      getDataController,
    }),
  });
  const workflowSectionRenderer = createSectionRenderer({
    workflowPanelRenderers,
    workflowOverviewRenderers,
  });
  const workflowRecommendationRunRenderer = createRecommendationRunRenderer({
    workflowPanelRenderers,
    workflowOverviewRenderers,
    ...createWorkflowRecommendationRunRendererCallbacks({
      getDataController,
    }),
  });

  return {
    workflowOverviewRenderers,
    workflowPanelRenderers,
    workflowRecommendationRunRenderer,
    workflowSectionRenderer,
  };
}
