import {
  autoMergeExecutionCheckedInputs,
  autoMergePlanningCheckedInputs,
} from "./auto-merge-precheck.js";

export function buildAutoMergeRejectionRequest({ taskContextPackage, reasons, now }) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "autoMergeRejection",
    artifact: {
      rejectedAt: now(),
      decisionRef: "humanDecision",
      reasons,
      checkedInputs: autoMergePlanningCheckedInputs(taskContextPackage),
    },
  };
}

export function buildAutoMergeFailureRequest({ taskContextPackage, reasons, now }) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "autoMergeFailure",
    artifact: {
      failedAt: now(),
      planRef: "autoMergePlan",
      reasons,
      checkedInputs: autoMergeExecutionCheckedInputs(taskContextPackage),
    },
  };
}

export function buildAutoMergePlanRequest({
  taskContextPackage,
  plannedAt,
  source,
  target,
  changedFiles,
  worktreeHeadMatchesAcceptedBase,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "autoMergePlan",
    artifact: {
      plannedAt,
      decisionRef: "humanDecision",
      source,
      target,
      changeSet: {
        changedFiles,
      },
      checks: [
        { name: "humanDecisionAccepted", passed: true },
        { name: "worktreeExists", passed: true },
        { name: "worktreeHeadMatchesAcceptedBase", passed: worktreeHeadMatchesAcceptedBase },
        { name: "worktreeContainsAcceptedWork", passed: true },
        { name: "targetBranchAvailable", passed: true },
      ],
    },
  };
}

export function buildAutoMergeResultRequest({
  taskContextPackage,
  mergedAt,
  source,
  target,
  changedFiles,
  sourceRebased,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "autoMergeResult",
    artifact: {
      mergedAt,
      planRef: "autoMergePlan",
      source,
      target,
      changeSet: {
        changedFiles,
      },
      checks: [
        { name: "mainWorktreeClean", passed: true },
        { name: "targetStillAtPlannedCommit", passed: true },
        { name: "sourceCommitted", passed: true },
        { name: "sourceRebasedOntoTarget", passed: sourceRebased },
        { name: "mergedFastForward", passed: true },
      ],
    },
  };
}
