import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStateFixtureTraceRecorder,
} from "../src/workflow/state-fixture-trace-recorder.js";
import {
  FIXTURE_TRACE_OPERATION,
} from "../src/workflow/state-fixture-trace-operations.js";
import {
  TERMINAL_FIXTURE_TRACE_APPENDERS,
} from "../src/workflow/state-fixture-terminal-materializers.js";

function terminalFixturePackage() {
  return {
    packageId: "task-context-package:tasks/stub-cancelled.yaml",
    currentWorkStage: "cancelled",
    fixture: {
      baseCommit: "abc123",
    },
    artifacts: {},
    agentRuns: [],
    timeline: [],
  };
}

test("terminal fixture materializers build a cancelled closeout trace", () => {
  const taskPackage = terminalFixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);
  const runtime = {
    id: "stub-cancelled",
    timestamp: "2026-05-21T00:00:00.000Z",
  };

  for (const operation of [
    FIXTURE_TRACE_OPERATION.CANCELLED_CONVERGENCE_FAILURE,
    FIXTURE_TRACE_OPERATION.CANCEL_TASK_DECISION_REQUEST,
    FIXTURE_TRACE_OPERATION.CANCEL_TASK_DECISION,
    FIXTURE_TRACE_OPERATION.CANCELLED_TASK_CLOSEOUT,
  ]) {
    TERMINAL_FIXTURE_TRACE_APPENDERS[operation](trace, taskPackage, runtime);
  }

  assert.deepEqual(
    taskPackage.timeline.map((event) => event.artifactType),
    ["convergenceFailure", "humanDecisionRequest", "humanDecision", "taskCloseout"],
  );
  assert.equal(taskPackage.artifacts.humanDecision.body.decision, "cancel-task");
  assert.deepEqual(taskPackage.artifacts.taskCloseout.body.cleanup, {
    worktree: {
      path: ".workflow/worktrees/tasks/stub-cancelled",
      removed: true,
    },
    branch: {
      name: "workflow/tasks/stub-cancelled",
      deleted: true,
    },
  });
});

test("terminal fixture materializers expose only terminal operation appenders", () => {
  assert.deepEqual(Object.keys(TERMINAL_FIXTURE_TRACE_APPENDERS), [
    FIXTURE_TRACE_OPERATION.CANCELLED_CONVERGENCE_FAILURE,
    FIXTURE_TRACE_OPERATION.CANCEL_TASK_DECISION_REQUEST,
    FIXTURE_TRACE_OPERATION.CANCEL_TASK_DECISION,
    FIXTURE_TRACE_OPERATION.CANCELLED_TASK_CLOSEOUT,
  ]);
});
