import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { normalizePathForGit } from "./git-path.js";

function runGit(args, { cwd }) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function resolveWorktreePath(worktreePath, repositoryDir) {
  if (!worktreePath) return null;
  return isAbsolute(worktreePath) ? worktreePath : resolve(repositoryDir, worktreePath);
}

function changedFilesInWorktree(cwd) {
  const trackedOutput = runGit(["diff", "--name-only", "HEAD", "--"], { cwd });
  const untrackedOutput = runGit(["ls-files", "--others", "--exclude-standard"], { cwd });
  return Array.from(new Set([
    ...trackedOutput.split(/\r?\n/).filter(Boolean),
    ...untrackedOutput.split(/\r?\n/).filter(Boolean),
  ]));
}

function repositoryChangedFiles(cwd) {
  const output = runGit(["status", "--porcelain", "--untracked-files=all"], { cwd });
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3));
}

function stagedChangedFiles(cwd) {
  const output = runGit(["diff", "--cached", "--name-only", "--"], { cwd });
  return output
    .split(/\r?\n/)
    .filter(Boolean);
}

function diffChangedFiles(baseCommit, headCommit, cwd) {
  const output = runGit(["diff", "--name-only", `${baseCommit}...${headCommit}`, "--"], { cwd });
  return output
    .split(/\r?\n/)
    .filter(Boolean);
}

function isAncestor(ancestorCommit, descendantCommit, cwd) {
  try {
    runGit(["merge-base", "--is-ancestor", ancestorCommit, descendantCommit], { cwd });
    return true;
  } catch {
    return false;
  }
}

function checkedInputs(taskContextPackage) {
  return {
    currentWorkStage: taskContextPackage?.currentWorkStage ?? null,
    hasHumanDecision: Boolean(taskContextPackage?.artifacts?.humanDecision?.body),
    hasConvergenceSuccess: Boolean(taskContextPackage?.artifacts?.convergenceSuccess?.body),
    hasIsolatedWorkspace: Boolean(taskContextPackage?.artifacts?.isolatedWorkspace?.body),
  };
}

function rejectionRequest({ taskContextPackage, reasons, now }) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "autoMergeRejection",
    artifact: {
      rejectedAt: now(),
      decisionRef: "humanDecision",
      reasons,
      checkedInputs: checkedInputs(taskContextPackage),
    },
  };
}

function reason(code, message) {
  return { code, message };
}

function autoMergeExecutionCheckedInputs(taskContextPackage) {
  return {
    currentWorkStage: taskContextPackage?.currentWorkStage ?? null,
    hasAutoMergePlan: Boolean(taskContextPackage?.artifacts?.autoMergePlan?.body),
    hasIsolatedWorkspace: Boolean(taskContextPackage?.artifacts?.isolatedWorkspace?.body),
    hasHumanDecision: Boolean(taskContextPackage?.artifacts?.humanDecision?.body),
  };
}

function failureRequest({ taskContextPackage, reasons, now }) {
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

function commitMessageForTask(taskContextPackage) {
  const taskId = taskContextPackage?.taskDraft?.id ?? taskContextPackage?.packageId ?? "task";
  const taskName = taskContextPackage?.taskDraft?.name ?? "自动合并任务成果";
  return `chore(auto-merge): ${taskId} ${taskName}`;
}

export function planAutoMerge({
  taskContextPackage,
  repositoryDir = process.cwd(),
  targetBranch = "main",
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const reasons = [];
  if (taskContextPackage.currentWorkStage !== "auto-merge-planning") {
    reasons.push(reason("WRONG_STAGE", "任务不在 auto-merge-planning 环节。"));
  }

  const humanDecision = taskContextPackage.artifacts?.humanDecision;
  if (!humanDecision?.body) {
    reasons.push(reason("MISSING_HUMAN_DECISION", "任务上下文包缺少 humanDecision。"));
  } else if (humanDecision.body.decision !== "accept-convergence") {
    reasons.push(reason("HUMAN_DECISION_NOT_ACCEPTED", "人工决策没有接受收敛成功。"));
  }

  const convergenceSuccess = taskContextPackage.artifacts?.convergenceSuccess;
  if (!convergenceSuccess?.body) {
    reasons.push(reason("MISSING_CONVERGENCE_SUCCESS", "任务上下文包缺少 convergenceSuccess。"));
  }

  const isolatedWorkspace = taskContextPackage.artifacts?.isolatedWorkspace;
  if (!isolatedWorkspace?.body) {
    reasons.push(reason("MISSING_ISOLATED_WORKSPACE", "任务上下文包缺少 isolatedWorkspace。"));
  }

  if (reasons.length > 0) {
    return {
      appendRequest: rejectionRequest({ taskContextPackage, reasons, now }),
      error: null,
    };
  }

  const worktreePath = humanDecision.body.acceptedWork?.worktreePath
    ?? isolatedWorkspace.body.worktreePath;
  const absoluteWorktreePath = resolveWorktreePath(worktreePath, repositoryDir);
  if (!absoluteWorktreePath || !existsSync(absoluteWorktreePath)) {
    return {
      appendRequest: rejectionRequest({
        taskContextPackage,
        reasons: [reason("WORKTREE_MISSING", "隔离工作树不存在。")],
        now,
      }),
      error: null,
    };
  }

  let worktreeHead;
  let targetCommit;
  let changedFiles;
  try {
    worktreeHead = runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath });
    targetCommit = runGit(["rev-parse", targetBranch], { cwd: repositoryDir });
    changedFiles = changedFilesInWorktree(absoluteWorktreePath);
  } catch (error) {
    return {
      appendRequest: rejectionRequest({
        taskContextPackage,
        reasons: [reason("GIT_CHECK_FAILED", error.message)],
        now,
      }),
      error: null,
    };
  }

  const acceptedBase = humanDecision.body.acceptedWork?.baseCommit;
  const worktreeHeadMatchesAcceptedBase = worktreeHead === acceptedBase;
  const worktreeContainsAcceptedWork = worktreeHeadMatchesAcceptedBase
    || isAncestor(acceptedBase, worktreeHead, absoluteWorktreePath);
  if (!worktreeContainsAcceptedWork) {
    return {
      appendRequest: rejectionRequest({
        taskContextPackage,
        reasons: [reason("WORKTREE_HEAD_MISMATCH", "隔离工作树 HEAD 不包含人工接受时的 baseCommit。")],
        now,
      }),
      error: null,
    };
  }

  const committedChangedFiles = worktreeHeadMatchesAcceptedBase
    ? []
    : diffChangedFiles(acceptedBase, worktreeHead, absoluteWorktreePath);
  const planChangedFiles = changedFiles.length > 0
    ? changedFiles
    : committedChangedFiles;

  if (planChangedFiles.length === 0) {
    return {
      appendRequest: rejectionRequest({
        taskContextPackage,
        reasons: [reason("NO_CHANGES", "隔离工作树没有可合并变更。")],
        now,
      }),
      error: null,
    };
  }

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "autoMergePlan",
      artifact: {
        plannedAt: now(),
        decisionRef: "humanDecision",
        source: {
          worktreePath: normalizePathForGit(worktreePath),
          branchName: humanDecision.body.acceptedWork?.branchName ?? isolatedWorkspace.body.branchName,
          baseCommit: acceptedBase,
          currentCommit: worktreeHead,
        },
        target: {
          branchName: targetBranch,
          currentCommit: targetCommit,
        },
        changeSet: {
          changedFiles: planChangedFiles,
        },
        checks: [
          { name: "humanDecisionAccepted", passed: true },
          { name: "worktreeExists", passed: true },
          { name: "worktreeHeadMatchesAcceptedBase", passed: worktreeHeadMatchesAcceptedBase },
          { name: "worktreeContainsAcceptedWork", passed: true },
          { name: "targetBranchAvailable", passed: true },
        ],
      },
    },
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

  const reasons = [];
  if (taskContextPackage.currentWorkStage !== "auto-merge-execution") {
    reasons.push(reason("WRONG_STAGE", "任务不在 auto-merge-execution 环节。"));
  }

  const autoMergePlan = taskContextPackage.artifacts?.autoMergePlan;
  if (!autoMergePlan?.body) {
    reasons.push(reason("MISSING_AUTO_MERGE_PLAN", "任务上下文包缺少 autoMergePlan。"));
  }

  const isolatedWorkspace = taskContextPackage.artifacts?.isolatedWorkspace;
  if (!isolatedWorkspace?.body) {
    reasons.push(reason("MISSING_ISOLATED_WORKSPACE", "任务上下文包缺少 isolatedWorkspace。"));
  }

  const humanDecision = taskContextPackage.artifacts?.humanDecision;
  if (!humanDecision?.body) {
    reasons.push(reason("MISSING_HUMAN_DECISION", "任务上下文包缺少 humanDecision。"));
  }

  if (reasons.length > 0) {
    return {
      appendRequest: failureRequest({ taskContextPackage, reasons, now }),
      error: null,
    };
  }

  const plan = autoMergePlan.body;
  const worktreePath = plan.source?.worktreePath ?? isolatedWorkspace.body.worktreePath;
  const absoluteWorktreePath = resolveWorktreePath(worktreePath, repositoryDir);
  if (!absoluteWorktreePath || !existsSync(absoluteWorktreePath)) {
    return {
      appendRequest: failureRequest({
        taskContextPackage,
        reasons: [reason("WORKTREE_MISSING", "隔离工作树不存在。")],
        now,
      }),
      error: null,
    };
  }

  let activeBranch;
  let targetCommit;
  let mainChangedFiles;
  let worktreeChangedFiles;
  try {
    activeBranch = runGit(["branch", "--show-current"], { cwd: repositoryDir });
    targetCommit = runGit(["rev-parse", plan.target.branchName], { cwd: repositoryDir });
    mainChangedFiles = repositoryChangedFiles(repositoryDir);
    worktreeChangedFiles = changedFilesInWorktree(absoluteWorktreePath);
  } catch (error) {
    return {
      appendRequest: failureRequest({
        taskContextPackage,
        reasons: [reason("GIT_CHECK_FAILED", error.message)],
        now,
      }),
      error: null,
    };
  }

  if (activeBranch !== plan.target.branchName) {
    return {
      appendRequest: failureRequest({
        taskContextPackage,
        reasons: [reason("TARGET_NOT_CHECKED_OUT", "目标分支不是主工作树当前分支。")],
        now,
      }),
      error: null,
    };
  }

  if (targetCommit !== plan.target.currentCommit) {
    return {
      appendRequest: failureRequest({
        taskContextPackage,
        reasons: [reason("TARGET_MOVED", "目标分支已经不在自动合并计划记录的 commit。")],
        now,
      }),
      error: null,
    };
  }

  if (mainChangedFiles.length > 0) {
    return {
      appendRequest: failureRequest({
        taskContextPackage,
        reasons: [reason("MAIN_WORKTREE_DIRTY", "主工作区存在未提交变更。")],
        now,
      }),
      error: null,
    };
  }

  let sourceCommit;
  let afterCommit;
  let sourceRebased = false;
  let mergedChangedFiles = worktreeChangedFiles;
  try {
    sourceCommit = runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath });
    if (worktreeChangedFiles.length > 0) {
      runGit(["add", "-A"], { cwd: absoluteWorktreePath });
      const stagedFiles = stagedChangedFiles(absoluteWorktreePath);
      if (stagedFiles.length === 0) {
        return {
          appendRequest: failureRequest({
            taskContextPackage,
            reasons: [reason("NO_STAGED_CHANGES", "隔离工作树没有可提交的暂存变更。")],
            now,
          }),
          error: null,
        };
      }
      runGit([
        "-c",
        "user.name=Simple Workflow",
        "-c",
        "user.email=simple-workflow@example.invalid",
        "commit",
        "-m",
        commitMessageForTask(taskContextPackage),
      ], { cwd: absoluteWorktreePath });
      sourceCommit = runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath });
    }

    if (worktreeChangedFiles.length === 0 && sourceCommit === plan.source.baseCommit) {
      return {
        appendRequest: failureRequest({
          taskContextPackage,
          reasons: [reason("NO_CHANGES", "隔离工作树没有可提交变更。")],
          now,
        }),
        error: null,
      };
    }

    if (!isAncestor(targetCommit, sourceCommit, repositoryDir)) {
      runGit(["rebase", targetCommit], { cwd: absoluteWorktreePath });
      sourceCommit = runGit(["rev-parse", "HEAD"], { cwd: absoluteWorktreePath });
      sourceRebased = true;
    }
    mergedChangedFiles = worktreeChangedFiles.length > 0
      ? worktreeChangedFiles
      : diffChangedFiles(targetCommit, sourceCommit, repositoryDir);
    runGit(["merge", "--ff-only", sourceCommit], { cwd: repositoryDir });
    afterCommit = runGit(["rev-parse", plan.target.branchName], { cwd: repositoryDir });
  } catch (error) {
    try {
      runGit(["rebase", "--abort"], { cwd: absoluteWorktreePath });
    } catch {
      // No rebase in progress.
    }
    return {
      appendRequest: failureRequest({
        taskContextPackage,
        reasons: [reason("AUTO_MERGE_FAILED", error.message)],
        now,
      }),
      error: null,
    };
  }

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "autoMergeResult",
      artifact: {
        mergedAt: now(),
        planRef: "autoMergePlan",
        source: {
          worktreePath: normalizePathForGit(worktreePath),
          branchName: plan.source.branchName,
          baseCommit: plan.source.baseCommit,
          commit: sourceCommit,
        },
        target: {
          branchName: plan.target.branchName,
          beforeCommit: plan.target.currentCommit,
          afterCommit,
        },
        changeSet: {
          changedFiles: mergedChangedFiles,
        },
        checks: [
          { name: "mainWorktreeClean", passed: true },
          { name: "targetStillAtPlannedCommit", passed: true },
          { name: "sourceCommitted", passed: true },
          { name: "sourceRebasedOntoTarget", passed: sourceRebased },
          { name: "mergedFastForward", passed: true },
        ],
      },
    },
    error: null,
  };
}
