export function buildConvergenceSuccessDecisionRequest({
  taskContextPackage,
  convergenceSuccess,
  requestedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "humanDecisionRequest",
    artifact: {
      requestedAt,
      reason: "Agent 已产出 convergenceSuccess，需要人工决定是否接受收敛成功。",
      convergenceSuccessRef: convergenceSuccess.artifactId,
      decisionOptions: [
        "accept-convergence",
        "continue-convergence-with-guidance",
        "cancel-task",
      ],
    },
  };
}

export function buildConvergenceFailureDecisionRequest({
  taskContextPackage,
  convergenceFailure,
  requestedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "humanDecisionRequest",
    artifact: {
      requestedAt,
      reason: "任务当前无法自动收敛，需要人工提供收敛意见或取消任务。",
      targetRef: convergenceFailure.artifactId,
      decisionOptions: [
        "continue-convergence-with-guidance",
        "cancel-task",
      ],
    },
  };
}

export function buildAutoMergeIssueDecisionRequest({
  taskContextPackage,
  artifactType,
  targetArtifact,
  requestedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "humanDecisionRequest",
    artifact: {
      requestedAt,
      reason: "自动合并无法继续，需要人工提供收敛意见或取消任务。",
      targetType: artifactType,
      targetRef: targetArtifact.artifactId,
      decisionOptions: [
        "continue-convergence-with-guidance",
        "cancel-task",
      ],
    },
  };
}
