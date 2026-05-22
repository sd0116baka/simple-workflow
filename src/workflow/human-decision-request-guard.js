import {
  humanDecisionArtifactByType,
  humanDecisionRequestMatchesTarget,
  latestHumanDecisionTarget,
} from "./human-decision-targets.js";
import { artifactRecord } from "./task-package-artifacts.js";

function defaultError(actionLabel, reason) {
  return `任务${reason}，不能${actionLabel}。`;
}

export function resolvePendingHumanDecisionRequest({
  taskContextPackage,
  actionLabel,
  requiredOption = null,
  requiredTargetKind = null,
  missingRequestError = null,
  missingRequiredTargetError = null,
  missingTargetError = null,
  mismatchedTargetError = null,
  disallowedOptionError = null,
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (!actionLabel) {
    throw new Error("actionLabel is required");
  }
  if (taskContextPackage.currentWorkStage !== "human-decision") {
    return {
      humanDecisionRequest: null,
      decisionTarget: null,
      error: defaultError(actionLabel, "不在 human-decision 环节"),
    };
  }

  const humanDecisionRequest = artifactRecord(taskContextPackage, "humanDecisionRequest");
  if (!humanDecisionRequest?.body) {
    return {
      humanDecisionRequest: null,
      decisionTarget: null,
      error: missingRequestError
        ?? defaultError(actionLabel, "上下文包缺少 humanDecisionRequest"),
    };
  }

  if (requiredTargetKind && !humanDecisionArtifactByType(taskContextPackage, requiredTargetKind)) {
    return {
      humanDecisionRequest,
      decisionTarget: null,
      error: missingRequiredTargetError
        ?? defaultError(actionLabel, `上下文包缺少 ${requiredTargetKind}`),
    };
  }

  const decisionTarget = latestHumanDecisionTarget(taskContextPackage);
  if (!decisionTarget) {
    return {
      humanDecisionRequest,
      decisionTarget: null,
      error: missingTargetError
        ?? defaultError(actionLabel, "上下文包缺少人工决策请求指向的目标产物"),
    };
  }
  if (requiredTargetKind && decisionTarget.kind !== requiredTargetKind) {
    return {
      humanDecisionRequest,
      decisionTarget,
      error: mismatchedTargetError
        ?? defaultError(actionLabel, `人工决策请求没有指向当前 ${requiredTargetKind}`),
    };
  }
  if (!humanDecisionRequestMatchesTarget(humanDecisionRequest, decisionTarget)) {
    return {
      humanDecisionRequest,
      decisionTarget,
      error: mismatchedTargetError
        ?? defaultError(actionLabel, "人工决策请求没有指向当前目标产物"),
    };
  }
  if (requiredOption && !humanDecisionRequest.body.decisionOptions?.includes(requiredOption)) {
    return {
      humanDecisionRequest,
      decisionTarget,
      error: disallowedOptionError
        ?? defaultError(actionLabel, `人工决策请求不允许 ${requiredOption}`),
    };
  }

  return {
    humanDecisionRequest,
    decisionTarget,
    error: null,
  };
}
