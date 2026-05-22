import { toRecommendationSnapshot } from "./recommendation-run-snapshot.js";

export function createRecommendationRunLifecycleState({
  idPrefix = "recommendation-run",
} = {}) {
  let latestRun = null;
  let sequence = 0;

  function getLatestRun() {
    return latestRun;
  }

  function setLatestRun(run) {
    latestRun = run ?? null;
    return latestRun;
  }

  function hasRunningRun() {
    return latestRun?.status === "running";
  }

  function nextRunId() {
    sequence += 1;
    return `${idPrefix}-${sequence}`;
  }

  function snapshotLatestRun() {
    return toRecommendationSnapshot(latestRun);
  }

  return {
    getLatestRun,
    setLatestRun,
    hasRunningRun,
    nextRunId,
    snapshotLatestRun,
  };
}
