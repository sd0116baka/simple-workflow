import { autoMergeReason } from "./auto-merge-reason.js";
import { artifactBody, hasArtifactBody } from "./task-package-artifacts.js";

export function autoMergePlanningCheckedInputs(taskContextPackage) {
  return {
    currentWorkStage: taskContextPackage?.currentWorkStage ?? null,
    hasHumanDecision: hasArtifactBody(taskContextPackage, "humanDecision"),
    hasConvergenceSuccess: hasArtifactBody(taskContextPackage, "convergenceSuccess"),
    hasIsolatedWorkspace: hasArtifactBody(taskContextPackage, "isolatedWorkspace"),
  };
}

export function autoMergeExecutionCheckedInputs(taskContextPackage) {
  return {
    currentWorkStage: taskContextPackage?.currentWorkStage ?? null,
    hasAutoMergePlan: hasArtifactBody(taskContextPackage, "autoMergePlan"),
    hasIsolatedWorkspace: hasArtifactBody(taskContextPackage, "isolatedWorkspace"),
    hasHumanDecision: hasArtifactBody(taskContextPackage, "humanDecision"),
  };
}

export function planAutoMergePrecheckReasons(taskContextPackage) {
  const reasons = [];
  if (taskContextPackage.currentWorkStage !== "auto-merge-planning") {
    reasons.push(autoMergeReason("WRONG_STAGE", "任务不在 auto-merge-planning 环节。"));
  }

  const humanDecision = artifactBody(taskContextPackage, "humanDecision");
  if (!humanDecision) {
    reasons.push(autoMergeReason("MISSING_HUMAN_DECISION", "任务上下文包缺少 humanDecision。"));
  } else if (humanDecision.decision !== "accept-convergence") {
    reasons.push(autoMergeReason("HUMAN_DECISION_NOT_ACCEPTED", "人工决策没有接受收敛成功。"));
  }

  if (!artifactBody(taskContextPackage, "convergenceSuccess")) {
    reasons.push(autoMergeReason("MISSING_CONVERGENCE_SUCCESS", "任务上下文包缺少 convergenceSuccess。"));
  }

  if (!artifactBody(taskContextPackage, "isolatedWorkspace")) {
    reasons.push(autoMergeReason("MISSING_ISOLATED_WORKSPACE", "任务上下文包缺少 isolatedWorkspace。"));
  }

  return reasons;
}

export function executeAutoMergePrecheckReasons(taskContextPackage) {
  const reasons = [];
  if (taskContextPackage.currentWorkStage !== "auto-merge-execution") {
    reasons.push(autoMergeReason("WRONG_STAGE", "任务不在 auto-merge-execution 环节。"));
  }

  if (!artifactBody(taskContextPackage, "autoMergePlan")) {
    reasons.push(autoMergeReason("MISSING_AUTO_MERGE_PLAN", "任务上下文包缺少 autoMergePlan。"));
  }

  if (!artifactBody(taskContextPackage, "isolatedWorkspace")) {
    reasons.push(autoMergeReason("MISSING_ISOLATED_WORKSPACE", "任务上下文包缺少 isolatedWorkspace。"));
  }

  if (!artifactBody(taskContextPackage, "humanDecision")) {
    reasons.push(autoMergeReason("MISSING_HUMAN_DECISION", "任务上下文包缺少 humanDecision。"));
  }

  return reasons;
}
