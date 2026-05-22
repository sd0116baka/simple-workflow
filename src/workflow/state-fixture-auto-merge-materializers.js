import {
  fixtureBranchName,
  fixtureWorktreePath,
} from "./state-fixture-paths.js";
import {
  buildAutoMergePlanRequest,
  buildAutoMergeResultRequest,
} from "./auto-merge-append-request.js";
import {
  buildMergedTaskCloseoutRequest,
} from "./task-closeout-contract.js";
import { FIXTURE_TRACE_OPERATION } from "./state-fixture-trace-operations.js";

function appendAutoMergePlan(trace, taskPackage, { id, timestamp }) {
  trace.addRequestArtifact(
    "autoMergePlan",
    "autoMergePlan",
    buildAutoMergePlanRequest({
      taskContextPackage: taskPackage,
      plannedAt: timestamp,
      source: {
        worktreePath: fixtureWorktreePath(id),
        branchName: fixtureBranchName(id),
        baseCommit: taskPackage.fixture.baseCommit ?? "fixture-base",
        currentCommit: taskPackage.fixture.baseCommit ?? "fixture-base",
      },
      target: {
        branchName: "main",
        currentCommit: taskPackage.fixture.baseCommit ?? "fixture-base",
      },
      changedFiles: [`fixtures/${id}.txt`],
      worktreeHeadMatchesAcceptedBase: true,
    }),
    timestamp,
  );
}

function appendAutoMergeResult(trace, taskPackage, { id, timestamp }) {
  trace.addRequestArtifact(
    "autoMergeResult",
    "autoMergeResult",
    buildAutoMergeResultRequest({
      taskContextPackage: taskPackage,
      mergedAt: timestamp,
      source: {
        worktreePath: fixtureWorktreePath(id),
        branchName: fixtureBranchName(id),
        baseCommit: taskPackage.fixture.baseCommit ?? "fixture-base",
        commit: "fixture-commit",
      },
      target: {
        branchName: "main",
        beforeCommit: taskPackage.fixture.baseCommit ?? "fixture-base",
        afterCommit: "fixture-commit",
      },
      changedFiles: [`fixtures/${id}.txt`],
      sourceRebased: false,
    }),
    timestamp,
  );
}

function appendMergedTaskCloseout(trace, taskPackage, { id, timestamp }) {
  trace.addRequestArtifact(
    "taskCloseout",
    "taskCloseout",
    buildMergedTaskCloseoutRequest({
      taskContextPackage: taskPackage,
      closeoutAt: timestamp,
      worktreePath: fixtureWorktreePath(id),
      branchName: fixtureBranchName(id),
    }),
    timestamp,
  );
}

export const AUTO_MERGE_FIXTURE_TRACE_APPENDERS = Object.freeze({
  [FIXTURE_TRACE_OPERATION.AUTO_MERGE_PLAN]: appendAutoMergePlan,
  [FIXTURE_TRACE_OPERATION.AUTO_MERGE_RESULT]: appendAutoMergeResult,
  [FIXTURE_TRACE_OPERATION.MERGED_TASK_CLOSEOUT]: appendMergedTaskCloseout,
});
