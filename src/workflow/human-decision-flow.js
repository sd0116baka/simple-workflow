import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve } from "node:path";

function latestTaskCompletion(taskContextPackage) {
  return taskContextPackage?.artifacts?.taskCompletion ?? null;
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

export function requestHumanDecisionForTaskCompletion({
  taskContextPackage,
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const taskCompletion = latestTaskCompletion(taskContextPackage);
  if (!taskCompletion) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 taskCompletion，不能请求人工接受完成。",
    };
  }

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "humanDecisionRequest",
      artifact: {
        requestedAt: now(),
        reason: "Agent 已产出 taskCompletion，需要人工决定是否接受任务完成。",
        taskCompletionRef: taskCompletion.artifactId,
        decisionOptions: [
          "accept-completion",
          "request-changes",
        ],
      },
    },
    error: null,
  };
}

export function acceptTaskCompletion({
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
      error: "任务不在 human-decision 环节，不能接受完成。",
    };
  }

  const taskCompletion = latestTaskCompletion(taskContextPackage);
  if (!taskCompletion) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 taskCompletion，不能接受完成。",
    };
  }
  const humanDecisionRequest = taskContextPackage.artifacts?.humanDecisionRequest;
  if (!humanDecisionRequest?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 humanDecisionRequest，不能接受完成。",
    };
  }
  const isolatedWorkspace = taskContextPackage.artifacts?.isolatedWorkspace;
  if (!isolatedWorkspace?.body) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能接受完成。",
    };
  }

  const cwd = worktreeCwd(taskContextPackage, repositoryDir);
  const changedFiles = changedFilesInWorktree(cwd);

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "humanDecision",
      artifact: {
        decision: "accept-completion",
        decidedAt: now(),
        taskCompletionRef: taskCompletion.artifactId,
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
        nextRequiredStage: "auto-merge",
      },
    },
    error: null,
  };
}
