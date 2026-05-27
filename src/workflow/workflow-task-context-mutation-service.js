export function createWorkflowTaskContextMutationService({
  taskContextWorkspace,
  getLatestRecommendationRun,
}) {
  async function persistTaskContextPackage(taskContextPackage) {
    await taskContextWorkspace.persistTaskContextPackage(taskContextPackage);
  }

  async function applyAppendRequest(appendRequest, { currentWorkStage } = {}) {
    const latestRecommendationRun = getLatestRecommendationRun();
    const { taskPool, taskContextPackage } = await taskContextWorkspace.applyAppendRequestToCurrentPool(
      appendRequest,
      { currentWorkStage, latestRecommendationRun },
    );
    if (taskContextPackage && latestRecommendationRun) {
      latestRecommendationRun.taskContextPackage = taskContextPackage;
    }
    return taskPool;
  }

  async function transitionCurrentWorkStage(packageId, { currentWorkStage } = {}) {
    const latestRecommendationRun = getLatestRecommendationRun();
    const { taskPool, taskContextPackage } = await taskContextWorkspace.transitionCurrentPackageStage(
      packageId,
      { currentWorkStage, latestRecommendationRun },
    );
    if (taskContextPackage && latestRecommendationRun) {
      latestRecommendationRun.taskContextPackage = taskContextPackage;
    }
    return taskPool;
  }

  return {
    persistTaskContextPackage,
    applyAppendRequest,
    transitionCurrentWorkStage,
  };
}
