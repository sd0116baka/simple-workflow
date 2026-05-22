import { existsSync } from "node:fs";
import {
  createAgentSessionRequest,
  createStubAgentSession,
} from "./agent-session-contract.js";
import { inputArtifactRefsForConvergence } from "./agent-input-refs.js";
import { nextConvergenceAgentRunId } from "./agent-run-ids.js";
import { resolveWorktreePath } from "./git-worktree-state.js";
import {
  buildConvergenceAdviceRequest,
  buildConvergenceFailureRequest,
  buildConvergenceSuccessRequest,
} from "./convergence-contract.js";
import { convergenceOutcome } from "./convergence-outcome-policy.js";
import { latestReviewedExecutionArtifacts } from "./reviewed-execution-artifacts.js";
import { artifactBody } from "./task-package-artifacts.js";

function mainAgentSessionId(taskContextPackage) {
  const mainInitialization = taskContextPackage?.agentRuns?.[0];
  return mainInitialization?.role === "main" ? mainInitialization.sessionId : null;
}

function isolatedWorkspacePath(taskContextPackage, repositoryDir) {
  const worktreePath = artifactBody(taskContextPackage, "isolatedWorkspace")?.worktreePath;
  return resolveWorktreePath(worktreePath, repositoryDir);
}

export async function runConvergence({
  taskContextPackage,
  runAgentSession = createStubAgentSession,
  repositoryDir = process.cwd(),
  maxIterations = null,
  now = () => new Date().toISOString(),
  onProgress,
  signal,
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }

  const sessionId = mainAgentSessionId(taskContextPackage);
  if (!sessionId) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 main agent 初始化记录，不能运行收敛环节。",
    };
  }

  const {
    executionReport,
    reviewReport,
  } = latestReviewedExecutionArtifacts(taskContextPackage);
  if (!executionReport) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 executionReport，不能运行收敛环节。",
    };
  }
  if (!reviewReport) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 reviewReport，不能运行收敛环节。",
    };
  }

  const runId = nextConvergenceAgentRunId(taskContextPackage);
  const cwd = isolatedWorkspacePath(taskContextPackage, repositoryDir);
  if (cwd && !existsSync(cwd)) {
    const worktreePath = artifactBody(taskContextPackage, "isolatedWorkspace")?.worktreePath;
    return {
      appendRequest: null,
      error: `隔离工作树路径不存在，不能运行收敛环节：${worktreePath}`,
    };
  }

  const inputArtifactRefs = inputArtifactRefsForConvergence(
    taskContextPackage,
    executionReport,
    reviewReport,
  );
  const startedAt = now();
  const session = await runAgentSession(createAgentSessionRequest({
    role: "main",
    packageId: taskContextPackage.packageId,
    sessionId,
    cwd,
    taskContextPackage,
    runId,
    inputArtifactRefs,
    onProgress,
    signal,
  }));
  const finishedAt = now();
  const commonRequest = {
    taskContextPackage,
    runId,
    session,
    inputArtifactRefs,
    executionReport,
    reviewReport,
    startedAt,
    finishedAt,
  };
  const outcome = convergenceOutcome({ taskContextPackage, reviewReport, maxIterations });
  const appendRequest = outcome.kind === "success"
    ? buildConvergenceSuccessRequest(commonRequest)
    : outcome.kind === "failure"
      ? buildConvergenceFailureRequest({
          ...commonRequest,
          ...outcome.failureInput,
        })
      : buildConvergenceAdviceRequest(commonRequest);

  return {
    appendRequest,
    error: null,
  };
}
