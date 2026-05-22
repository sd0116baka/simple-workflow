import {
  createAgentSessionRequest,
  createStubAgentSession,
} from "./agent-session-contract.js";
import { inputArtifactRefsForReview } from "./agent-input-refs.js";
import { nextReviewAgentRunId } from "./agent-run-ids.js";
import { buildReviewReportRequest } from "./review-report-contract.js";
import { latestExecutionReport } from "./reviewed-execution-artifacts.js";
import { hasArtifactBody } from "./task-package-artifacts.js";

function hasIsolatedWorkspace(taskContextPackage) {
  return hasArtifactBody(taskContextPackage, "isolatedWorkspace");
}

export async function runReviewAgent({
  taskContextPackage,
  runAgentSession = createStubAgentSession,
  now = () => new Date().toISOString(),
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
  if (!hasIsolatedWorkspace(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能运行 review agent。",
    };
  }

  const runId = nextReviewAgentRunId(taskContextPackage);
  const inputArtifactRefs = inputArtifactRefsForReview(taskContextPackage, executionReport);
  const startedAt = now();
  const session = await runAgentSession(createAgentSessionRequest({
    role: "review",
    packageId: taskContextPackage.packageId,
    taskContextPackage,
    runId,
    inputArtifactRefs,
  }));
  const finishedAt = now();

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
