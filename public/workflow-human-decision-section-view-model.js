import {
  decisionMatchesRequest,
  humanDecisionTargetLabel,
} from "./human-decision-panel-view-model.js";
import {
  artifactRecord,
  latestArtifactRecord,
} from "./task-package-artifacts.js";

export function buildHumanDecisionSectionViewModel(taskContextPackage) {
  const request = artifactRecord(taskContextPackage, "humanDecisionRequest");
  const historicalDecision = artifactRecord(taskContextPackage, "humanDecision");
  const decision = decisionMatchesRequest(historicalDecision, request) ? historicalDecision : null;
  const convergenceSuccess = artifactRecord(taskContextPackage, "convergenceSuccess");
  const convergenceFailure = latestArtifactRecord(taskContextPackage, "convergenceFailure");
  const humanConvergenceGuidance = latestArtifactRecord(taskContextPackage, "humanConvergenceGuidance");
  const autoMergeRejection = artifactRecord(taskContextPackage, "autoMergeRejection");
  const autoMergeFailure = artifactRecord(taskContextPackage, "autoMergeFailure");

  const viewModel = {
    rawObject: {
      convergenceSuccess,
      convergenceFailure,
      humanConvergenceGuidance,
      autoMergeRejection,
      autoMergeFailure,
      humanDecisionRequest: request,
      humanDecision: historicalDecision,
    },
    inputs: [
      { label: "决策目标", value: humanDecisionTargetLabel(request) },
      { label: "人工决策请求", value: request?.artifactId ?? "未请求" },
      { label: "人工决策", value: decision?.body?.decision ?? "未决策" },
      { label: "当前环节", value: taskContextPackage?.currentWorkStage ?? "未生成" },
    ],
    statusText: "等待人工决策",
    panel: decision || request ? { kind: "humanDecision" } : null,
    text: null,
  };

  if (decision) {
    return {
      ...viewModel,
      statusText: decision.body?.decision === "cancel-task" ? "已取消" : "已接受收敛成功",
    };
  }

  if (!request) {
    return {
      ...viewModel,
      statusText: convergenceSuccess ? "未请求" : "等待收敛结果",
      text: convergenceSuccess
        ? "已生成收敛成功证据，但尚未请求人工决策。"
        : "等待收敛成功证据。",
    };
  }

  return viewModel;
}
