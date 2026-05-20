import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";
import { removeWorkspaceAndBranch } from "./task-closeout-flow.js";

function latestConvergenceSuccess(taskContextPackage) {
  return taskContextPackage?.artifacts?.convergenceSuccess ?? null;
}

function latestArtifact(taskContextPackage, artifactType) {
  const artifacts = taskContextPackage?.artifacts?.[artifactType];
  return Array.isArray(artifacts) && artifacts.length > 0
    ? artifacts[artifacts.length - 1]
    : null;
}

function latestConvergenceFailure(taskContextPackage) {
  return latestArtifact(taskContextPackage, "convergenceFailure");
}

function normalizePathForGit(filePath) {
  return filePath.replace(/\\/g, "/");
}

function worktreeCwd(taskContextPackage, repositoryDir) {
  const worktreePath = taskContextPackage?.artifacts?.isolatedWorkspace?.body?.worktreePath;
  if (!worktreePath) return null;
  return isAbsolute(worktreePath) ? worktreePath : resolve(repositoryDir, worktreePath);
}

function changedFilesInWorktree(cwd) {
  const output = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3));
}

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
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "humanDecisionRequest",
      artifact: {
        requestedAt: now(),
        reason: "Agent 已产出 convergenceSuccess，需要人工决定是否接受收敛成功。",
        convergenceSuccessRef: convergenceSuccess.artifactId,
        decisionOptions: [
          "accept-completion",
          "request-changes",
        ],
      },
    },
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
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "humanDecisionRequest",
      artifact: {
        requestedAt: now(),
        reason: "任务当前无法自动收敛，需要人工提供收敛意见或取消任务。",
        targetRef: convergenceFailure.artifactId,
        decisionOptions: [
          "retry-with-guidance",
          "cancel-task",
        ],
      },
    },
    error: null,
  };
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  const text = String(value ?? "").trim();
  return text ? [text] : [];
}

export function provideHumanConvergenceGuidance({
  taskContextPackage,
  guidance,
  focusAreas = [],
  avoidRepeating = [],
  expectedNextOutcome = "",
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (taskContextPackage.currentWorkStage !== "human-decision") {
    return {
      appendRequest: null,
      error: "任务不在 human-decision 环节，不能追加人工收敛意见。",
    };
  }

  const convergenceFailure = latestConvergenceFailure(taskContextPackage);
  if (!convergenceFailure) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 convergenceFailure，不能追加人工收敛意见。",
    };
  }
  const humanDecisionRequest = taskContextPackage.artifacts?.humanDecisionRequest;
  if (humanDecisionRequest?.body?.targetRef !== convergenceFailure.artifactId) {
    return {
      appendRequest: null,
      error: "人工决策请求没有指向当前 convergenceFailure，不能追加人工收敛意见。",
    };
  }
  const normalizedGuidance = String(guidance ?? "").trim();
  if (!normalizedGuidance) {
    return {
      appendRequest: null,
      error: "人工收敛意见不能为空。",
    };
  }

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "humanConvergenceGuidance",
      artifact: {
        convergenceFailureRef: convergenceFailure.artifactId,
        decidedAt: now(),
        guidance: normalizedGuidance,
        focusAreas: normalizeList(focusAreas),
        avoidRepeating: normalizeList(avoidRepeating),
        expectedNextOutcome: String(expectedNextOutcome ?? "").trim(),
      },
    },
    error: null,
  };
}

export function acceptConvergenceSuccess({
  taskContextPackage,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (taskContextPackage.currentWorkStage !== "human-decision") {
    return {
      appendRequest: null,
      error: "任务不在 human-decision 环节，不能接受收敛成功。",
    };
  }

  const convergenceSuccess = latestConvergenceSuccess(taskContextPackage);
  if (!convergenceSuccess) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 convergenceSuccess，不能接受收敛成功。",
    };
  }
  const humanDecisionRequest = taskContextPackage.artifacts?.humanDecisionRequest;
  if (!humanDecisionRequest?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 humanDecisionRequest，不能接受收敛成功。",
    };
  }
  const isolatedWorkspace = taskContextPackage.artifacts?.isolatedWorkspace;
  if (!isolatedWorkspace?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能接受收敛成功。",
    };
  }

  const cwd = worktreeCwd(taskContextPackage, repositoryDir);
  if (!cwd) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少隔离工作树路径，不能接受收敛成功。",
    };
  }

  let changedFiles;
  try {
    changedFiles = changedFilesInWorktree(cwd);
  } catch (error) {
    return {
      appendRequest: null,
      error: `无法读取隔离工作树变更，不能接受收敛成功：${error.message}`,
    };
  }

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "humanDecision",
      artifact: {
        decision: "accept-completion",
        decidedAt: now(),
        convergenceSuccessRef: convergenceSuccess.artifactId,
        acceptedWork: {
          isolatedWorkspaceRef: isolatedWorkspace.artifactId,
          worktreePath: isolatedWorkspace.body.worktreePath,
          branchName: isolatedWorkspace.body.branchName,
          baseCommit: isolatedWorkspace.body.baseCommit,
        },
        worktreeSnapshot: {
          cwd: normalizePathForGit(relative(repositoryDir, cwd)),
          changedFiles,
        },
        nextRequiredStage: "auto-merge-planning",
      },
    },
    error: null,
  };
}

export function cancelTaskAfterConvergenceFailure({
  taskContextPackage,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (taskContextPackage.currentWorkStage !== "human-decision") {
    return {
      appendRequest: null,
      error: "任务不在 human-decision 环节，不能取消任务。",
    };
  }

  const convergenceFailure = latestConvergenceFailure(taskContextPackage);
  if (!convergenceFailure) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 convergenceFailure，不能取消收敛失败任务。",
    };
  }
  const humanDecisionRequest = taskContextPackage.artifacts?.humanDecisionRequest;
  if (humanDecisionRequest?.body?.targetRef !== convergenceFailure.artifactId) {
    return {
      appendRequest: null,
      error: "人工决策请求没有指向当前 convergenceFailure，不能取消任务。",
    };
  }
  const isolatedWorkspace = taskContextPackage.artifacts?.isolatedWorkspace;
  if (!isolatedWorkspace?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能确认执行侧资源已恢复。",
    };
  }

  try {
    const cleanup = removeWorkspaceAndBranch({
      repositoryDir,
      worktreePath: isolatedWorkspace.body.worktreePath,
      branchName: isolatedWorkspace.body.branchName,
    });
    if (cleanup.error) return { appendRequest: null, error: cleanup.error };
  } catch (error) {
    return {
      appendRequest: null,
      error: error.message,
    };
  }

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "humanDecision",
      artifact: {
        decision: "cancel-task",
        decidedAt: now(),
        targetRef: convergenceFailure.artifactId,
        restoredExecutionState: {
          isolatedWorkspaceRef: isolatedWorkspace.artifactId,
          worktreePath: isolatedWorkspace.body.worktreePath,
          branchName: isolatedWorkspace.body.branchName,
          restored: true,
        },
        finalStage: "cancelled",
      },
    },
    error: null,
  };
}
