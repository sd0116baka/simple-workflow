import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStateFixtureTraceRecorder,
} from "../src/workflow/state-fixture-trace-recorder.js";
import {
  EXECUTION_PREPARATION_FIXTURE_TRACE_APPENDERS,
} from "../src/workflow/state-fixture-execution-preparation-materializers.js";
import {
  FIXTURE_TRACE_OPERATION,
} from "../src/workflow/state-fixture-trace-operations.js";

function executionFixturePackage() {
  return {
    packageId: "task-context-package:tasks/stub-execution-agent.yaml",
    taskDraft: {
      goal: "用于测试 execution preparation materializer。",
      acceptanceCriteria: ["记录 execution preparation artifacts"],
    },
    fixture: {
      baseCommit: "abc123",
    },
    artifacts: {},
    agentRuns: [],
    timeline: [],
  };
}

test("execution preparation materializers build intent, admission, and workspace artifacts", () => {
  const taskPackage = executionFixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);
  const runtime = {
    id: "stub-execution-agent",
    timestamp: "2026-05-21T00:00:00.000Z",
  };

  for (const operation of [
    FIXTURE_TRACE_OPERATION.EXECUTION_INTENT,
    FIXTURE_TRACE_OPERATION.EXECUTION_AUTHORIZATION,
    FIXTURE_TRACE_OPERATION.ISOLATED_WORKSPACE,
  ]) {
    EXECUTION_PREPARATION_FIXTURE_TRACE_APPENDERS[operation](trace, taskPackage, runtime);
  }

  assert.deepEqual(taskPackage.timeline.map((event) => event.artifactType), [
    "executionIntent",
    "executionAuthorization",
    "isolatedWorkspace",
  ]);
  assert.equal(taskPackage.artifacts.executionIntent.body.confidence, "low");
  assert.equal(taskPackage.artifacts.executionAuthorization.body.termination.maxIterations, 2);
  assert.equal(
    taskPackage.artifacts.isolatedWorkspace.body.worktreePath,
    ".workflow/worktrees/tasks/stub-execution-agent",
  );
});

test("execution preparation materializer table exposes only preparation operations", () => {
  assert.deepEqual(Object.keys(EXECUTION_PREPARATION_FIXTURE_TRACE_APPENDERS), [
    FIXTURE_TRACE_OPERATION.EXECUTION_INTENT,
    FIXTURE_TRACE_OPERATION.EXECUTION_AUTHORIZATION,
    FIXTURE_TRACE_OPERATION.ISOLATED_WORKSPACE,
  ]);
});
