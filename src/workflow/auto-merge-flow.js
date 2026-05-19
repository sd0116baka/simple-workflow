import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

function runGit(args, { cwd }) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function normalizePathForGit(filePath) {
  return filePath.replace(/\\/g, "/");
}

function resolveWorktreePath(worktreePath, repositoryDir) {
  if (!worktreePath) return null;
  return isAbsolute(worktreePath) ? worktreePath : resolve(repositoryDir, worktreePath);
}

function changedFilesInWorktree(cwd) {
  const output = runGit(["status", "--porcelain", "--untracked-files=all"], { cwd });
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3));
}

function checkedInputs(taskContextPackage) {
  return {
    currentWorkStage: taskContextPackage?.currentWorkStage ?? null,
    hasHumanDecision: Boolean(taskContextPackage?.artifacts?.humanDecision?.body),
    hasTaskCompletion: Boolean(taskContextPackage?.artifacts?.taskCompletion?.body),
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
  if (taskContextPackage.currentWorkStage !== "auto-merge") {
    reasons.push(reason("WRONG_STAGE", "任务不在 auto-merge 环节。"));
  }

  const humanDecision = taskContextPackage.artifacts?.humanDecision;
  if (!humanDecision?.body) {
    reasons.push(reason("MISSING_HUMAN_DECISION", "任务上下文包缺少 humanDecision。"));
  } else if (humanDecision.body.decision !== "accept-completion") {
    reasons.push(reason("HUMAN_DECISION_NOT_ACCEPTED", "人工决策没有接受任务完成。"));
  }

  const taskCompletion = taskContextPackage.artifacts?.taskCompletion;
  if (!taskCompletion?.body) {
    reasons.push(reason("MISSING_TASK_COMPLETION", "任务上下文包缺少 taskCompletion。"));
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
  if (worktreeHead !== acceptedBase) {
    return {
      appendRequest: rejectionRequest({
        taskContextPackage,
        reasons: [reason("WORKTREE_HEAD_MISMATCH", "隔离工作树 HEAD 与人工接受时的 baseCommit 不一致。")],
        now,
      }),
      error: null,
    };
  }

  if (changedFiles.length === 0) {
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
        },
        target: {
          branchName: targetBranch,
          currentCommit: targetCommit,
        },
        changeSet: {
          changedFiles,
        },
        checks: [
          { name: "humanDecisionAccepted", passed: true },
          { name: "worktreeExists", passed: true },
          { name: "worktreeHeadMatchesAcceptedBase", passed: true },
          { name: "targetBranchAvailable", passed: true },
        ],
      },
    },
    error: null,
  };
}
