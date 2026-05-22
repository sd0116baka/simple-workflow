import {
  createWorkflowPageRecommendationSyncState,
  isWorkflowPageRecommendationRunRunning,
  markWorkflowPageRecommendationSynced,
  renderWorkflowRecommendationConnectionInterrupted,
  setWorkflowPageRecommendationRun,
} from "./workflow-page-recommendation-sync-state.js";
import { syncWorkflowPageSnapshotRecommendationPackage } from "./workflow-page-snapshot-state.js";

export function createWorkflowPageRecommendationSyncController({
  workflowApi,
  elements,
  getSnapshotState,
  setSnapshotState,
  resolveActiveTaskContextPackage,
  renderRecommendationRun: renderRecommendationRunWithState,
  createRecommendationSyncState = createWorkflowPageRecommendationSyncState,
} = {}) {
  let recommendationSyncState = createRecommendationSyncState();

  function getRecommendationRun() {
    return recommendationSyncState.recommendationRun;
  }

  function renderRecommendationRun() {
    renderRecommendationRunWithState({
      activeTaskContextPackage: resolveActiveTaskContextPackage({
        recommendationRun: recommendationSyncState.recommendationRun,
      }),
      recommendationRun: recommendationSyncState.recommendationRun,
      snapshotState: getSnapshotState(),
    });
  }

  function setRecommendationRun(nextRecommendationRun, { syncTaskPackage = false } = {}) {
    recommendationSyncState = setWorkflowPageRecommendationRun(
      recommendationSyncState,
      nextRecommendationRun,
    );
    if (syncTaskPackage) {
      setSnapshotState(syncWorkflowPageSnapshotRecommendationPackage({
        snapshotState: getSnapshotState(),
        recommendationRun: recommendationSyncState.recommendationRun,
      }));
    }
  }

  async function loadRecommendationRun() {
    const payload = await workflowApi.loadRecommendationRun();
    setRecommendationRun(payload.recommendationRun);
    recommendationSyncState = markWorkflowPageRecommendationSynced(recommendationSyncState);
    renderRecommendationRun();
  }

  function markRecommendationConnectionInterrupted() {
    return renderWorkflowRecommendationConnectionInterrupted({
      elements,
      recommendationSyncState,
    });
  }

  async function syncRecommendationRunSilently() {
    try {
      await loadRecommendationRun();
    } catch {
      markRecommendationConnectionInterrupted();
    }
  }

  return {
    getRecommendationRun,
    isRecommendationRunRunning: () =>
      isWorkflowPageRecommendationRunRunning(recommendationSyncState),
    latestRecommendationSyncAt: () => recommendationSyncState.latestSyncAt,
    loadRecommendationRun,
    markRecommendationConnectionInterrupted,
    renderRecommendationRun,
    setRecommendationRun,
    syncRecommendationRunSilently,
  };
}
