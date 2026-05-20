import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";

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

function artifactByType(taskContextPackage, artifactType) {
  if (artifactType === "convergenceFailure" || artifactType === "humanConvergenceGuidance") {
    return latestArtifact(taskContextPackage, artifactType);
  }
  return taskContextPackage?.artifacts?.[artifactType] ?? null;
}

function latestHumanDecisionTarget(taskContextPackage) {
  const humanDecisionRequest = taskContextPackage?.artifacts?.humanDecisionRequest;
  const requestedTargetType = humanDecisionRequest?.body?.targetType;
  const requestedTargetRef = humanDecisionRequest?.body?.targetRef;
  if (requestedTargetType && requestedTargetRef) {
    const targetArtifact = artifactByType(taskContextPackage, requestedTargetType);
    if (targetArtifact?.artifactId === requestedTargetRef) {
      return {
        kind: requestedTargetType,
        artifact: targetArtifact,
        requestRefField: "targetRef",
      };
    }
  }

  const requestedSuccessRef = humanDecisionRequest?.body?.convergenceSuccessRef;
  if (requestedSuccessRef) {
    const convergenceSuccess = latestConvergenceSuccess(taskContextPackage);
    if (convergenceSuccess?.artifactId === requestedSuccessRef) {
      return {
        kind: "convergenceSuccess",
        artifact: convergenceSuccess,
        requestRefField: "convergenceSuccessRef",
      };
    }
  }

  const requestedFailureRef = humanDecisionRequest?.body?.targetRef;
  if (requestedFailureRef) {
    const convergenceFailure = latestConvergenceFailure(taskContextPackage);
    if (convergenceFailure?.artifactId === requestedFailureRef) {
      return {
        kind: "convergenceFailure",
        artifact: convergenceFailure,
        requestRefField: "targetRef",
      };
    }
  }

  const convergenceFailure = latestConvergenceFailure(taskContextPackage);
  if (convergenceFailure) {
    return {
      kind: "convergenceFailure",
      artifact: convergenceFailure,
      requestRefField: "targetRef",
    };
  }
  const convergenceSuccess = latestConvergenceSuccess(taskContextPackage);
  if (convergenceSuccess) {
    return {
      kind: "convergenceSuccess",
      artifact: convergenceSuccess,
      requestRefField: "convergenceSuccessRef",
    };
  }
  return null;
}

function humanDecisionRequestMatchesTarget(humanDecisionRequest, target) {
  if (!humanDecisionRequest?.body || !target?.artifact) return false;
  if (target.kind === "convergenceSuccess") {
    return humanDecisionRequest.body.convergenceSuccessRef === target.artifact.artifactId;
  }
  if (humanDecisionRequest.body.targetType) {
    return humanDecisionRequest.body.targetType === target.kind
      && humanDecisionRequest.body.targetRef === target.artifact.artifactId;
  }
  return humanDecisionRequest.body[target.requestRefField] === target.artifact.artifactId;
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
          "accept-convergence",
          "continue-convergence-with-guidance",
          "cancel-task",
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
          "continue-convergence-with-guidance",
          "cancel-task",
        ],
      },
    },
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

  const targetArtifact = artifactByType(taskContextPackage, artifactType);
  if (!targetArtifact) {
    return {
      appendRequest: null,
      error: `任务上下文包缺少 ${artifactType}，不能请求人工处理自动合并问题。`,
    };
  }

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "humanDecisionRequest",
      artifact: {
        requestedAt: now(),
        reason: "自动合并无法继续，需要人工提供收敛意见或取消任务。",
        targetType: artifactType,
        targetRef: targetArtifact.artifactId,
        decisionOptions: [
          "continue-convergence-with-guidance",
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

  const decisionTarget = latestHumanDecisionTarget(taskContextPackage);
  if (!decisionTarget) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少人工决策请求指向的目标产物，不能追加人工收敛意见。",
    };
  }
  const humanDecisionRequest = taskContextPackage.artifacts?.humanDecisionRequest;
  if (!humanDecisionRequestMatchesTarget(humanDecisionRequest, decisionTarget)) {
    return {
      appendRequest: null,
      error: "人工决策请求没有指向当前目标产物，不能追加人工收敛意见。",
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
        decision: "continue-convergence-with-guidance",
        targetType: decisionTarget.kind,
        targetRef: decisionTarget.artifact.artifactId,
        decidedAt: now(),
        guidance: normalizedGuidance,
        focusAreas: normalizeList(focusAreas),
        avoidRepeating: normalizeList(avoidRepeating),
        expectedNextOutcome: String(expectedNextOutcome ?? "").trim(),
        nextRequiredStage: "convergence",
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
  if (humanDecisionRequest.body.convergenceSuccessRef !== convergenceSuccess.artifactId) {
    return {
      appendRequest: null,
      error: "人工决策请求没有指向当前 convergenceSuccess，不能接受收敛成功。",
    };
  }
  if (!humanDecisionRequest.body.decisionOptions?.includes("accept-convergence")) {
    return {
      appendRequest: null,
      error: "人工决策请求不允许接受收敛成功。",
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
        decision: "accept-convergence",
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

export function cancelTaskAfterHumanDecisionRequest({
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

  const decisionTarget = latestHumanDecisionTarget(taskContextPackage);
  if (!decisionTarget) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少人工决策请求指向的目标产物，不能取消任务。",
    };
  }
  const humanDecisionRequest = taskContextPackage.artifacts?.humanDecisionRequest;
  if (!humanDecisionRequestMatchesTarget(humanDecisionRequest, decisionTarget)) {
    return {
      appendRequest: null,
      error: "人工决策请求没有指向当前目标产物，不能取消任务。",
    };
  }
  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "humanDecision",
      artifact: {
        decision: "cancel-task",
        decidedAt: now(),
        targetType: decisionTarget.kind,
        targetRef: decisionTarget.artifact.artifactId,
        nextRequiredStage: "task-closeout",
      },
    },
    error: null,
  };
}
