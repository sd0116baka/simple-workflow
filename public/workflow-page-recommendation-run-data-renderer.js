import { createRecommendationRunRenderTargets } from "./workflow-page-render-targets.js";

export function createWorkflowPageRecommendationRunDataRenderer({
  elements,
  workflowRecommendationRunRenderer,
} = {}) {
  const recommendationRunElements = createRecommendationRunRenderTargets(elements);

  function renderRecommendationRun({
    activeTaskContextPackage,
    recommendationRun,
    snapshotState,
  }) {
    workflowRecommendationRunRenderer.render({
      elements: recommendationRunElements,
      recommendationRun,
      poolEntryCount: snapshotState.poolEntries.length,
      startupCheck: snapshotState.startupCheck,
      taskContextPackage: activeTaskContextPackage,
    });
  }

  return {
    renderRecommendationRun,
  };
}
