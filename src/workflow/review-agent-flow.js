import { existsSync } from "node:fs";
import {
  agentSessionErrorMessage,
  agentSessionFailure,
  buildAgentRunAppendRequest,
  createAgentSessionRequest,
  createStubAgentSession,
} from "./agent-session-contract.js";
import { inputArtifactRefsForReview } from "./agent-input-refs.js";
import { nextReviewAgentRunId } from "./agent-run-ids.js";
import { resolveWorktreePath } from "./git-worktree-state.js";
import { buildReviewReportRequest } from "./review-report-contract.js";
import {
  isUsableExecutionReport,
  latestExecutionReport,
} from "./reviewed-execution-artifacts.js";
import { artifactBody, hasArtifactBody } from "./task-package-artifacts.js";

function hasIsolatedWorkspace(taskContextPackage) {
  return hasArtifactBody(taskContextPackage, "isolatedWorkspace");
}

function isolatedWorkspacePath(taskContextPackage, repositoryDir) {
  const worktreePath = artifactBody(taskContextPackage, "isolatedWorkspace")?.worktreePath;
  return resolveWorktreePath(worktreePath, repositoryDir);
}

export async function runReviewAgent({
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

  const executionReport = latestExecutionReport(taskContextPackage);
  if (!executionReport) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 executionReport，不能运行 review agent。",
    };
  }
  if (!isUsableExecutionReport(taskContextPackage, executionReport)) {
    return {
      appendRequest: null,
      error: "最新 executionReport 来自失败的 execution agent，不能运行 review agent。",
    };
  }
  if (!hasIsolatedWorkspace(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能运行 review agent。",
    };
  }

  const runId = nextReviewAgentRunId(taskContextPackage);
  const cwd = isolatedWorkspacePath(taskContextPackage, repositoryDir);
  if (!existsSync(cwd)) {
    const worktreePath = artifactBody(taskContextPackage, "isolatedWorkspace")?.worktreePath;
    return {
      appendRequest: null,
      error: `隔离工作树路径不存在，不能运行 review agent：${worktreePath}`,
    };
  }

  const inputArtifactRefs = inputArtifactRefsForReview(taskContextPackage, executionReport);
  const startedAt = now();
  const session = await runAgentSession(createAgentSessionRequest({
    role: "review",
    packageId: taskContextPackage.packageId,
    taskContextPackage,
    cwd,
    runId,
    inputArtifactRefs,
    onProgress,
    signal,
  }));
  const finishedAt = now();
  const failure = agentSessionFailure(session);
  if (failure) {
    return {
      appendRequest: buildAgentRunAppendRequest({
        taskContextPackage,
        runId,
        role: "review",
        session,
        inputArtifactRefs,
        startedAt,
        finishedAt,
      }),
      error: agentSessionErrorMessage(session, "review agent 运行失败。"),
    };
  }

  return {
    appendRequest: buildReviewReportRequest({
      taskContextPackage,
      runId,
      session,
      inputArtifactRefs,
      startedAt,
      finishedAt,
    }),
    error: null,
  };
}
