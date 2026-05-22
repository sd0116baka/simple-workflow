import {
  fixtureBranchName,
  fixtureWorktreePath,
} from "./state-fixture-paths.js";
import {
  artifactRecord,
} from "./state-fixture-trace-recorder.js";
import { buildCancelTaskDecisionRequest } from "./human-decision-action-append.js";
import { buildConvergenceFailureDecisionRequest } from "./human-decision-request-append.js";
import {
  latestConvergenceFailure,
  latestHumanDecisionTarget,
} from "./human-decision-targets.js";
import {
  buildCancelledTaskCloseoutRequest,
} from "./task-closeout-contract.js";
import { FIXTURE_TRACE_OPERATION } from "./state-fixture-trace-operations.js";

function appendCancelledConvergenceFailure(trace, taskPackage, { timestamp }) {
  trace.addMultiArtifact("convergenceFailure", artifactRecord("convergenceFailure:001", {
    summary: "fixture cancelled convergence failure",
    reasonCode: "fixture-cancelled",
    basisRefs: [],
    attemptedFixes: [],
    unresolvedIssues: [],
    humanDecisionQuestion: "fixture 已取消。",
  }, timestamp));
}

function appendCancelTaskDecisionRequest(trace, taskPackage, { timestamp }) {
  trace.addRequestArtifact(
    "humanDecisionRequest",
    "humanDecisionRequest",
    buildConvergenceFailureDecisionRequest({
      taskContextPackage: taskPackage,
      convergenceFailure: latestConvergenceFailure(taskPackage),
      requestedAt: timestamp,
    }),
    timestamp,
  );
}

function appendCancelTaskDecision(trace, taskPackage, { timestamp }) {
  trace.addRequestArtifact(
    "humanDecision",
    "humanDecision",
    buildCancelTaskDecisionRequest({
      taskContextPackage: taskPackage,
      decisionTarget: latestHumanDecisionTarget(taskPackage),
      decidedAt: timestamp,
    }),
    timestamp,
  );
}

function appendCancelledTaskCloseout(trace, taskPackage, { id, timestamp }) {
  trace.addRequestArtifact(
    "taskCloseout",
    "taskCloseout",
    buildCancelledTaskCloseoutRequest({
      taskContextPackage: taskPackage,
      closeoutAt: timestamp,
      worktreePath: fixtureWorktreePath(id),
      branchName: fixtureBranchName(id),
    }),
    timestamp,
  );
}

export const TERMINAL_FIXTURE_TRACE_APPENDERS = Object.freeze({
  [FIXTURE_TRACE_OPERATION.CANCELLED_CONVERGENCE_FAILURE]: appendCancelledConvergenceFailure,
  [FIXTURE_TRACE_OPERATION.CANCEL_TASK_DECISION_REQUEST]: appendCancelTaskDecisionRequest,
  [FIXTURE_TRACE_OPERATION.CANCEL_TASK_DECISION]: appendCancelTaskDecision,
  [FIXTURE_TRACE_OPERATION.CANCELLED_TASK_CLOSEOUT]: appendCancelledTaskCloseout,
});
