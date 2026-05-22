import { buildExecutionAuthorizationRequest } from "./execution-admission-append-request.js";
import { buildExecutionIntentRequest } from "./execution-intent-contract.js";
import { buildIsolatedWorkspaceRequest } from "./isolated-workspace-contract.js";
import {
  fixtureBranchName,
  fixtureWorktreePath,
} from "./state-fixture-paths.js";
import { FIXTURE_TRACE_OPERATION } from "./state-fixture-trace-operations.js";

function appendExecutionIntent(trace, taskPackage, { timestamp }) {
  trace.addRequestArtifact(
    "executionIntent",
    "executionIntent",
    buildExecutionIntentRequest({
      packageId: taskPackage.packageId,
      confidence: "low",
      selectionReasoning: ["测试状态种子生成。"],
      candidateComparison: [
        {
          packageId: taskPackage.packageId,
          decision: "selected",
          reason: "状态桩目标任务。",
        },
      ],
      executionBrief: {
        goalInterpretation: taskPackage.taskDraft.goal,
        expectedOutcome: taskPackage.taskDraft.acceptanceCriteria,
        implementationHints: [],
        riskSignals: [],
        openQuestions: [],
      },
    }),
    timestamp,
  );
}

function appendExecutionAuthorization(trace, taskPackage, { timestamp }) {
  trace.addRequestArtifact(
    "executionAuthorization",
    "executionAuthorization",
    buildExecutionAuthorizationRequest({
      taskContextPackage: taskPackage,
      authorizedAt: timestamp,
      runtimeSnapshot: {
        activeWork: null,
        worktree: {
          clean: true,
          changedFiles: [],
        },
      },
      maxIterations: 2,
    }).appendRequest,
    timestamp,
  );
}

function appendIsolatedWorkspace(trace, taskPackage, { id, timestamp }) {
  trace.addRequestArtifact(
    "isolatedWorkspace",
    "isolatedWorkspace",
    buildIsolatedWorkspaceRequest({
      taskContextPackage: taskPackage,
      worktreePath: fixtureWorktreePath(id),
      branchName: fixtureBranchName(id),
      baseBranch: "main",
      baseCommit: taskPackage.fixture.baseCommit ?? "fixture-base",
    }),
    timestamp,
  );
}

export const EXECUTION_PREPARATION_FIXTURE_TRACE_APPENDERS = Object.freeze({
  [FIXTURE_TRACE_OPERATION.EXECUTION_INTENT]: appendExecutionIntent,
  [FIXTURE_TRACE_OPERATION.EXECUTION_AUTHORIZATION]: appendExecutionAuthorization,
  [FIXTURE_TRACE_OPERATION.ISOLATED_WORKSPACE]: appendIsolatedWorkspace,
});
