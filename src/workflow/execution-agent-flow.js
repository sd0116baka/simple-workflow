import { existsSync } from "node:fs";
import { relative } from "node:path";
import { inputArtifactRefsForExecution } from "./agent-input-refs.js";
import { nextExecutionAgentRunId } from "./agent-run-ids.js";
import {
  agentSessionErrorMessage,
  createAgentSessionRequest,
} from "./agent-session-contract.js";
import { buildExecutionReportRequest } from "./execution-report-contract.js";
import { runStubExecutionAgentSession } from "./execution-agent-stub-session.js";
import { changedFilesInWorktree, resolveWorktreePath } from "./git-worktree-state.js";
import { artifactBody, hasArtifactBody } from "./task-package-artifacts.js";

function hasExecutionAuthorization(taskContextPackage) {
  return hasArtifactBody(taskContextPackage, "executionAuthorization");
}

function hasMainAgentInitialization(taskContextPackage) {
  return taskContextPackage?.agentRuns?.[0]?.role === "main";
}

function hasIsolatedWorkspace(taskContextPackage) {
  return hasArtifactBody(taskContextPackage, "isolatedWorkspace");
}

function isolatedWorkspacePath(taskContextPackage, repositoryDir) {
  const worktreePath = artifactBody(taskContextPackage, "isolatedWorkspace")?.worktreePath;
  return resolveWorktreePath(worktreePath, repositoryDir);
}

export async function runExecutionAgent({
  taskContextPackage,
  runAgentSession = runStubExecutionAgentSession,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
  onProgress,
  signal,
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (!hasExecutionAuthorization(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少执行授权，不能运行 execution agent。",
    };
  }
  if (!hasIsolatedWorkspace(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能运行 execution agent。",
    };
  }
  if (!hasMainAgentInitialization(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 main agent 初始化记录，不能运行 execution agent。",
    };
  }

  const runId = nextExecutionAgentRunId(taskContextPackage);
  const cwd = isolatedWorkspacePath(taskContextPackage, repositoryDir);
  if (!existsSync(cwd)) {
    const worktreePath = artifactBody(taskContextPackage, "isolatedWorkspace")?.worktreePath;
    return {
      appendRequest: null,
      error: `隔离工作树路径不存在，不能运行 execution agent：${worktreePath}`,
    };
  }

  const startedAt = now();
  const inputArtifactRefs = inputArtifactRefsForExecution(taskContextPackage);
  const session = await runAgentSession(createAgentSessionRequest({
    role: "execution",
    packageId: taskContextPackage.packageId,
    taskContextPackage,
    cwd,
    runId,
    inputArtifactRefs,
    onProgress,
    signal,
  }));
  const changedFiles = changedFilesInWorktree(cwd);
  const finishedAt = now();
  const status = session.status ?? "succeeded";
  const error = status === "succeeded"
    ? null
    : agentSessionErrorMessage(session, "execution agent 运行失败。");

  return {
    appendRequest: buildExecutionReportRequest({
      taskContextPackage,
      runId,
      session,
      inputArtifactRefs,
      reportCwd: relative(repositoryDir, cwd),
      changedFiles,
      startedAt,
      finishedAt,
    }),
    error,
  };
}
