import { inputArtifactRefsForConvergence } from "./agent-input-refs.js";
import { nextConvergenceAgentRunId } from "./agent-run-ids.js";
import {
  buildConvergenceAdviceRequest,
  buildConvergenceFailureRequest,
  buildConvergenceSuccessRequest,
} from "./convergence-contract.js";
import { latestReviewedExecutionArtifacts } from "./reviewed-execution-artifacts.js";
import { FIXTURE_TRACE_OPERATION } from "./state-fixture-trace-operations.js";

function convergenceInputContext(taskPackage) {
  const {
    executionReport,
    reviewReport,
  } = latestReviewedExecutionArtifacts(taskPackage);
  return {
    executionReport,
    reviewReport,
    inputArtifactRefs: inputArtifactRefsForConvergence(
      taskPackage,
      executionReport,
      reviewReport,
    ),
  };
}

function appendConvergenceFailure(trace, taskPackage, { id, timestamp }) {
  const {
    executionReport,
    reviewReport,
    inputArtifactRefs,
  } = convergenceInputContext(taskPackage);
  const convergenceFailureRequest = buildConvergenceFailureRequest({
    taskContextPackage: taskPackage,
    runId: nextConvergenceAgentRunId(taskPackage),
    session: {
      sessionId: `fixture-main:${id}`,
      status: "succeeded",
    },
    inputArtifactRefs,
    executionReport,
    reviewReport,
    attemptedFixRefs: [],
    maxIterations: 1,
    completedIterations: 1,
    summary: "fixture convergence failure",
    reasonCode: "fixture-not-converged",
    humanDecisionQuestion: "提供人工收敛意见继续，或取消任务。",
    startedAt: timestamp,
    finishedAt: timestamp,
  });
  trace.addRequestMultiArtifactWithAgentRun(
    "convergenceFailure",
    "convergenceFailure:001",
    convergenceFailureRequest,
    timestamp,
  );
}

function appendConvergenceAdvice(trace, taskPackage, { id, timestamp }) {
  const {
    executionReport,
    reviewReport,
    inputArtifactRefs,
  } = convergenceInputContext(taskPackage);
  const convergenceAdviceRequest = buildConvergenceAdviceRequest({
    taskContextPackage: taskPackage,
    runId: nextConvergenceAgentRunId(taskPackage),
    session: {
      sessionId: `fixture-main:${id}`,
      status: "succeeded",
    },
    inputArtifactRefs,
    executionReport,
    reviewReport,
    summary: "fixture convergence advice",
    nextAction: "继续下一轮测试。",
    startedAt: timestamp,
    finishedAt: timestamp,
  });
  trace.addRequestMultiArtifactWithAgentRun(
    "convergenceAdvice",
    "convergenceAdvice:001",
    convergenceAdviceRequest,
    timestamp,
  );
}

function appendConvergenceSuccess(trace, taskPackage, { id, timestamp }) {
  const {
    executionReport,
    reviewReport,
    inputArtifactRefs,
  } = convergenceInputContext(taskPackage);
  trace.addRequestArtifact(
    "convergenceSuccess",
    "convergenceSuccess",
    buildConvergenceSuccessRequest({
      taskContextPackage: taskPackage,
      runId: "main-agent:convergence:success",
      session: {
        sessionId: `fixture-main:${id}`,
        status: "succeeded",
      },
      inputArtifactRefs,
      executionReport,
      reviewReport,
      summary: "fixture task completed",
      startedAt: timestamp,
      finishedAt: timestamp,
    }),
    timestamp,
  );
}

export const CONVERGENCE_FIXTURE_TRACE_APPENDERS = Object.freeze({
  [FIXTURE_TRACE_OPERATION.CONVERGENCE_ADVICE]: appendConvergenceAdvice,
  [FIXTURE_TRACE_OPERATION.CONVERGENCE_FAILURE]: appendConvergenceFailure,
  [FIXTURE_TRACE_OPERATION.CONVERGENCE_SUCCESS]: appendConvergenceSuccess,
});
