import { inputArtifactRefsForExecution } from "./agent-input-refs.js";
import { nextExecutionAgentRunId } from "./agent-run-ids.js";
import { buildExecutionReportRequest } from "./execution-report-contract.js";
import { buildMainAgentInitializationRequest } from "./main-agent-contract.js";
import { fixtureWorktreePath } from "./state-fixture-paths.js";
import { FIXTURE_TRACE_OPERATION } from "./state-fixture-trace-operations.js";

function appendMainAgentInitialization(trace, taskPackage, { id, timestamp }) {
  trace.addAgentRun(buildMainAgentInitializationRequest({
    taskContextPackage: taskPackage,
    session: {
      sessionId: `fixture-main:${id}`,
      status: "succeeded",
    },
    startedAt: timestamp,
    finishedAt: timestamp,
  }).agentRun);
}

function appendExecutionReport(trace, taskPackage, { id, timestamp }) {
  const executionReportRequest = buildExecutionReportRequest({
    taskContextPackage: taskPackage,
    runId: nextExecutionAgentRunId(taskPackage),
    session: {
      sessionId: `fixture-execution:${id}`,
      summary: "fixture execution report",
      status: "succeeded",
    },
    inputArtifactRefs: inputArtifactRefsForExecution(taskPackage),
    reportCwd: fixtureWorktreePath(id),
    changedFiles: [`fixtures/${id}.txt`],
    startedAt: timestamp,
    finishedAt: timestamp,
  });
  trace.addRequestMultiArtifactWithAgentRun(
    "executionReport",
    "executionReport:001",
    executionReportRequest,
    timestamp,
  );
}

function appendGuidedExecutionAgentRun(trace, taskPackage, { id, timestamp }) {
  trace.addAgentRun({
    runId: nextExecutionAgentRunId(taskPackage),
    role: "execution",
    sessionId: `fixture-execution-guided:${id}`,
    inputArtifactRefs: inputArtifactRefsForExecution(taskPackage),
    outputArtifactRefs: [],
    status: "running",
    startedAt: timestamp,
    finishedAt: null,
  });
}

export const EXECUTION_RUN_FIXTURE_TRACE_APPENDERS = Object.freeze({
  [FIXTURE_TRACE_OPERATION.MAIN_AGENT_INITIALIZATION]: appendMainAgentInitialization,
  [FIXTURE_TRACE_OPERATION.EXECUTION_REPORT]: appendExecutionReport,
  [FIXTURE_TRACE_OPERATION.GUIDED_EXECUTION_AGENT_RUN]: appendGuidedExecutionAgentRun,
});
