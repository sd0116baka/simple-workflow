import {
  buildAcceptConvergenceDecisionRequest,
  buildHumanConvergenceGuidanceRequest,
} from "./human-decision-action-append.js";
import {
  buildConvergenceFailureDecisionRequest,
  buildConvergenceSuccessDecisionRequest,
} from "./human-decision-request-append.js";
import {
  latestConvergenceFailure,
  latestHumanDecisionTarget,
} from "./human-decision-targets.js";
import {
  artifactRecord as taskPackageArtifactRecord,
} from "./task-package-artifacts.js";
import { FIXTURE_TRACE_OPERATION } from "./state-fixture-trace-operations.js";

function appendConvergenceFailureDecisionRequest(trace, taskPackage, { timestamp }) {
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

function appendHumanConvergenceGuidance(trace, taskPackage, { timestamp }) {
  trace.addRequestMultiArtifact(
    "humanConvergenceGuidance",
    "humanConvergenceGuidance:001",
    buildHumanConvergenceGuidanceRequest({
      taskContextPackage: taskPackage,
      decisionTarget: latestHumanDecisionTarget(taskPackage),
      guidance: "fixture 人工要求下一轮执行修正收敛失败点。",
      focusAreas: ["fixture 收敛失败点"],
      avoidRepeating: ["不要重复上一轮无效修正。"],
      expectedNextOutcome: "下一轮 execution-agent 使用人工意见继续修正。",
      decidedAt: timestamp,
    }),
    timestamp,
  );
}

function appendConvergenceSuccessDecisionRequest(trace, taskPackage, { timestamp }) {
  trace.addRequestArtifact(
    "humanDecisionRequest",
    "humanDecisionRequest",
    buildConvergenceSuccessDecisionRequest({
      taskContextPackage: taskPackage,
      convergenceSuccess: taskPackageArtifactRecord(taskPackage, "convergenceSuccess"),
      requestedAt: timestamp,
    }),
    timestamp,
  );
}

function appendAcceptConvergenceDecision(trace, taskPackage, { id, timestamp }) {
  trace.addRequestArtifact(
    "humanDecision",
    "humanDecision",
    buildAcceptConvergenceDecisionRequest({
      taskContextPackage: taskPackage,
      convergenceSuccess: taskPackageArtifactRecord(taskPackage, "convergenceSuccess"),
      isolatedWorkspace: taskPackageArtifactRecord(taskPackage, "isolatedWorkspace"),
      worktreeSnapshot: {
        cwd: `.workflow/worktrees/tasks/${id}`,
        changedFiles: [`fixtures/${id}.txt`],
      },
      decidedAt: timestamp,
    }),
    timestamp,
  );
}

export const HUMAN_DECISION_FIXTURE_TRACE_APPENDERS = Object.freeze({
  [FIXTURE_TRACE_OPERATION.CONVERGENCE_FAILURE_DECISION_REQUEST]: appendConvergenceFailureDecisionRequest,
  [FIXTURE_TRACE_OPERATION.HUMAN_CONVERGENCE_GUIDANCE]: appendHumanConvergenceGuidance,
  [FIXTURE_TRACE_OPERATION.CONVERGENCE_SUCCESS_DECISION_REQUEST]: appendConvergenceSuccessDecisionRequest,
  [FIXTURE_TRACE_OPERATION.ACCEPT_CONVERGENCE_DECISION]: appendAcceptConvergenceDecision,
});
