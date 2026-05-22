import {
  buildAutoMergeIssueDecisionRequest,
  buildConvergenceFailureDecisionRequest,
  buildConvergenceSuccessDecisionRequest,
} from "./human-decision-request-append.js";
import {
  humanDecisionArtifactByType,
  latestConvergenceFailure,
  latestConvergenceSuccess,
} from "./human-decision-targets.js";

export function requestHumanDecisionForConvergenceSuccess({
  taskContextPackage,
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const convergenceSuccess = latestConvergenceSuccess(taskContextPackage);
  if (!convergenceSuccess) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 convergenceSuccess，不能请求人工接受收敛成功。",
    };
  }

  return {
    appendRequest: buildConvergenceSuccessDecisionRequest({
      taskContextPackage,
      convergenceSuccess,
      requestedAt: now(),
    }),
    error: null,
  };
}

export function requestHumanDecisionForConvergenceFailure({
  taskContextPackage,
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const convergenceFailure = latestConvergenceFailure(taskContextPackage);
  if (!convergenceFailure) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 convergenceFailure，不能请求人工处理收敛失败。",
    };
  }

  return {
    appendRequest: buildConvergenceFailureDecisionRequest({
      taskContextPackage,
      convergenceFailure,
      requestedAt: now(),
    }),
    error: null,
  };
}

export function requestHumanDecisionForAutoMergeIssue({
  taskContextPackage,
  artifactType,
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (!["autoMergeRejection", "autoMergeFailure"].includes(artifactType)) {
    throw new Error("artifactType must be autoMergeRejection or autoMergeFailure");
  }

  const targetArtifact = humanDecisionArtifactByType(taskContextPackage, artifactType);
  if (!targetArtifact) {
    return {
      appendRequest: null,
      error: `任务上下文包缺少 ${artifactType}，不能请求人工处理自动合并问题。`,
    };
  }

  return {
    appendRequest: buildAutoMergeIssueDecisionRequest({
      taskContextPackage,
      artifactType,
      targetArtifact,
      requestedAt: now(),
    }),
    error: null,
  };
}
