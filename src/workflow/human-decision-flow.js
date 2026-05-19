function latestTaskCompletion(taskContextPackage) {
  return taskContextPackage?.artifacts?.taskCompletion ?? null;
}

export function requestHumanDecisionForTaskCompletion({
  taskContextPackage,
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const taskCompletion = latestTaskCompletion(taskContextPackage);
  if (!taskCompletion) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 taskCompletion，不能请求人工接受完成。",
    };
  }

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "humanDecisionRequest",
      artifact: {
        requestedAt: now(),
        reason: "Agent 已产出 taskCompletion，需要人工决定是否接受任务完成。",
        taskCompletionRef: taskCompletion.artifactId,
        decisionOptions: [
          "accept-completion",
          "request-changes",
        ],
      },
    },
    error: null,
  };
}
