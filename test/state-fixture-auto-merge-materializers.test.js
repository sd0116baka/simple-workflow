import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStateFixtureTraceRecorder,
} from "../src/workflow/state-fixture-trace-recorder.js";
import {
  FIXTURE_TRACE_OPERATION,
} from "../src/workflow/state-fixture-trace-operations.js";
import {
  AUTO_MERGE_FIXTURE_TRACE_APPENDERS,
} from "../src/workflow/state-fixture-auto-merge-materializers.js";

function autoMergeFixturePackage() {
  return {
    packageId: "task-context-package:tasks/stub-merged.yaml",
    currentWorkStage: "merged",
    fixture: {
      baseCommit: "abc123",
    },
    artifacts: {},
    agentRuns: [],
    timeline: [],
  };
}

test("auto merge fixture materializers build merge plan, result, and closeout trace", () => {
  const taskPackage = autoMergeFixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);
  const runtime = {
    id: "stub-merged",
    timestamp: "2026-05-21T00:00:00.000Z",
  };

  for (const operation of [
    FIXTURE_TRACE_OPERATION.AUTO_MERGE_PLAN,
    FIXTURE_TRACE_OPERATION.AUTO_MERGE_RESULT,
    FIXTURE_TRACE_OPERATION.MERGED_TASK_CLOSEOUT,
  ]) {
    AUTO_MERGE_FIXTURE_TRACE_APPENDERS[operation](trace, taskPackage, runtime);
  }

  assert.deepEqual(
    taskPackage.timeline.map((event) => event.artifactType),
    ["autoMergePlan", "autoMergeResult", "taskCloseout"],
  );
  assert.equal(taskPackage.artifacts.autoMergePlan.body.source.worktreePath, ".workflow/worktrees/tasks/stub-merged");
  assert.equal(taskPackage.artifacts.autoMergeResult.body.planRef, "autoMergePlan");
  assert.deepEqual(taskPackage.artifacts.taskCloseout.body.cleanup, {
    worktree: {
      path: ".workflow/worktrees/tasks/stub-merged",
      removed: true,
    },
    branch: {
      name: "workflow/tasks/stub-merged",
      deleted: true,
    },
  });
});

test("auto merge fixture materializers expose only auto merge operation appenders", () => {
  assert.deepEqual(Object.keys(AUTO_MERGE_FIXTURE_TRACE_APPENDERS), [
    FIXTURE_TRACE_OPERATION.AUTO_MERGE_PLAN,
    FIXTURE_TRACE_OPERATION.AUTO_MERGE_RESULT,
    FIXTURE_TRACE_OPERATION.MERGED_TASK_CLOSEOUT,
  ]);
});
