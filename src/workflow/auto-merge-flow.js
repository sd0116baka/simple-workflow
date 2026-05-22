import { normalizePathForGit } from "./git-path.js";
import {
  buildAutoMergeFailureRequest,
  buildAutoMergePlanRequest,
  buildAutoMergeRejectionRequest,
  buildAutoMergeResultRequest,
} from "./auto-merge-append-request.js";
import {
  executeAutoMergePrecheckReasons,
  planAutoMergePrecheckReasons,
} from "./auto-merge-precheck.js";
import { resolveAutoMergeExecutionPreflight } from "./auto-merge-execution-preflight.js";
import { runAutoMergeExecutionTransaction } from "./auto-merge-execution-transaction.js";
import { resolveAutoMergePlanningInputs } from "./auto-merge-planning-inputs.js";

export function planAutoMerge({
  taskContextPackage,
  repositoryDir = process.cwd(),
  targetBranch = "main",
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const reasons = planAutoMergePrecheckReasons(taskContextPackage);
  if (reasons.length > 0) {
    return {
      appendRequest: buildAutoMergeRejectionRequest({ taskContextPackage, reasons, now }),
      error: null,
    };
  }

  const planning = resolveAutoMergePlanningInputs({
    taskContextPackage,
    repositoryDir,
    targetBranch,
  });
  if (planning.reasons.length > 0) {
    return {
      appendRequest: buildAutoMergeRejectionRequest({
        taskContextPackage,
        reasons: planning.reasons,
        now,
      }),
      error: null,
    };
  }

  return {
    appendRequest: buildAutoMergePlanRequest({
      taskContextPackage,
      plannedAt: now(),
      source: planning.planningInputs.source,
      target: planning.planningInputs.target,
      changedFiles: planning.planningInputs.changedFiles,
      worktreeHeadMatchesAcceptedBase: planning.planningInputs.worktreeHeadMatchesAcceptedBase,
    }),
    error: null,
  };
}

export function executeAutoMerge({
  taskContextPackage,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const reasons = executeAutoMergePrecheckReasons(taskContextPackage);
  if (reasons.length > 0) {
    return {
      appendRequest: buildAutoMergeFailureRequest({ taskContextPackage, reasons, now }),
      error: null,
    };
  }

  const executionPreflight = resolveAutoMergeExecutionPreflight({
    taskContextPackage,
    repositoryDir,
  });
  if (executionPreflight.reasons.length > 0) {
    return {
      appendRequest: buildAutoMergeFailureRequest({
        taskContextPackage,
        reasons: executionPreflight.reasons,
        now,
      }),
      error: null,
    };
  }

  const {
    plan,
    worktreePath,
    absoluteWorktreePath,
    targetCommit,
    worktreeChangedFiles,
  } = executionPreflight.preflight;

  const transaction = runAutoMergeExecutionTransaction({
    taskContextPackage,
    repositoryDir,
    plan,
    absoluteWorktreePath,
    targetCommit,
    worktreeChangedFiles,
  });
  if (transaction.reasons.length > 0) {
    return {
      appendRequest: buildAutoMergeFailureRequest({
        taskContextPackage,
        reasons: transaction.reasons,
        now,
      }),
      error: null,
    };
  }

  return {
    appendRequest: buildAutoMergeResultRequest({
      taskContextPackage,
      mergedAt: now(),
      source: {
        worktreePath: normalizePathForGit(worktreePath),
        branchName: plan.source.branchName,
        baseCommit: plan.source.baseCommit,
        commit: transaction.transaction.sourceCommit,
      },
      target: {
        branchName: plan.target.branchName,
        beforeCommit: plan.target.currentCommit,
        afterCommit: transaction.transaction.afterCommit,
      },
      changedFiles: transaction.transaction.mergedChangedFiles,
      sourceRebased: transaction.transaction.sourceRebased,
    }),
    error: null,
  };
}
