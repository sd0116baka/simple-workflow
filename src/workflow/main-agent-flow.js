import { existsSync } from "node:fs";
import {
  agentSessionErrorMessage,
  agentSessionFailure,
  buildAgentRunAppendRequest,
  createAgentSessionRequest,
  createStubAgentSession,
} from "./agent-session-contract.js";
import { resolveWorktreePath } from "./git-worktree-state.js";
import {
  buildMainAgentInitializationRequest,
  MAIN_AGENT_INITIALIZATION_INPUT_REFS,
  MAIN_AGENT_INITIALIZATION_RUN_ID,
} from "./main-agent-contract.js";
import { artifactBody, hasArtifactBody } from "./task-package-artifacts.js";

function hasExecutionAuthorization(taskContextPackage) {
  return hasArtifactBody(taskContextPackage, "executionAuthorization");
}

function isolatedWorkspacePath(taskContextPackage, repositoryDir) {
  const worktreePath = artifactBody(taskContextPackage, "isolatedWorkspace")?.worktreePath;
  return resolveWorktreePath(worktreePath, repositoryDir);
}

export async function initializeMainAgent({
  taskContextPackage,
  runAgentSession = createStubAgentSession,
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
      error: "任务上下文包缺少执行授权，不能初始化 main agent。",
    };
  }

  const cwd = isolatedWorkspacePath(taskContextPackage, repositoryDir);
  if (cwd && !existsSync(cwd)) {
    const worktreePath = artifactBody(taskContextPackage, "isolatedWorkspace")?.worktreePath;
    return {
      appendRequest: null,
      error: `隔离工作树路径不存在，不能初始化 main agent：${worktreePath}`,
    };
  }

  const startedAt = now();
  const session = await runAgentSession(createAgentSessionRequest({
    role: "main",
    packageId: taskContextPackage.packageId,
    cwd,
    runId: MAIN_AGENT_INITIALIZATION_RUN_ID,
    inputArtifactRefs: MAIN_AGENT_INITIALIZATION_INPUT_REFS,
    taskContextPackage,
    onProgress,
    signal,
  }));
  const finishedAt = now();
  const failure = agentSessionFailure(session);
  if (failure) {
    return {
      appendRequest: buildAgentRunAppendRequest({
        taskContextPackage,
        runId: MAIN_AGENT_INITIALIZATION_RUN_ID,
        role: "main",
        session,
        inputArtifactRefs: MAIN_AGENT_INITIALIZATION_INPUT_REFS,
        startedAt,
        finishedAt,
      }),
      error: agentSessionErrorMessage(session, "main agent 初始化失败。"),
    };
  }

  return {
    appendRequest: buildMainAgentInitializationRequest({
      taskContextPackage,
      session,
      startedAt,
      finishedAt,
    }),
    error: null,
  };
}
