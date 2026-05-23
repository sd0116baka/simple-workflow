import { createRecommendationRunRenderTargets } from "./workflow-page-render-targets.js";
import { runningTaskContextPackageFromRecommendationRun } from "./recommendation-run-running-package.js";

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
    const runningTaskContextPackage =
      runningTaskContextPackageFromRecommendationRun(recommendationRun);
    workflowRecommendationRunRenderer.render({
      elements: recommendationRunElements,
      recommendationRun,
      poolEntryCount: snapshotState.poolEntries.length,
      startupCheck: snapshotState.startupCheck,
      taskContextPackage: runningTaskContextPackage ?? activeTaskContextPackage,
    });
  }

  return {
    renderRecommendationRun,
  };
}
