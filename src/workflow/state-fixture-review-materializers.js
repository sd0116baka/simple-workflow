import { inputArtifactRefsForReview } from "./agent-input-refs.js";
import { nextReviewAgentRunId } from "./agent-run-ids.js";
import { buildReviewReportRequest } from "./review-report-contract.js";
import { latestExecutionReport } from "./reviewed-execution-artifacts.js";
import { FIXTURE_TRACE_OPERATION } from "./state-fixture-trace-operations.js";

function appendReviewReport(trace, taskPackage, { id, plan, timestamp }) {
  const convergenceFailure = plan.operations.includes(FIXTURE_TRACE_OPERATION.CONVERGENCE_FAILURE);
  const reviewReportRequest = buildReviewReportRequest({
    taskContextPackage: taskPackage,
    runId: nextReviewAgentRunId(taskPackage),
    session: {
      sessionId: `fixture-review:${id}`,
      status: "succeeded",
    },
    inputArtifactRefs: inputArtifactRefsForReview(
      taskPackage,
      latestExecutionReport(taskPackage),
    ),
    outcome: convergenceFailure ? "failed" : "passed",
    summary: "fixture review report",
    findings: convergenceFailure
      ? [{ code: "fixture-not-converged", message: "用于测试收敛失败人工处理。" }]
      : [],
    startedAt: timestamp,
    finishedAt: timestamp,
  });
  trace.addRequestMultiArtifactWithAgentRun(
    "reviewReport",
    "reviewReport:001",
    reviewReportRequest,
    timestamp,
  );
}

export const REVIEW_FIXTURE_TRACE_APPENDERS = Object.freeze({
  [FIXTURE_TRACE_OPERATION.REVIEW_REPORT]: appendReviewReport,
});
