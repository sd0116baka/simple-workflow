import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStateFixtureTraceRecorder,
} from "../src/workflow/state-fixture-trace-recorder.js";
import {
  FIXTURE_TRACE_OPERATION,
} from "../src/workflow/state-fixture-trace-operations.js";
import {
  EXECUTION_FIXTURE_TRACE_APPENDERS,
} from "../src/workflow/state-fixture-execution-materializers.js";

function executionFixturePackage() {
  return {
    packageId: "task-context-package:tasks/stub-execution-agent.yaml",
    taskDraft: {
      goal: "用于测试 execution materializer。",
      acceptanceCriteria: ["记录 execution trace artifacts"],
    },
    fixture: {
      baseCommit: "abc123",
    },
    artifacts: {},
    agentRuns: [],
    timeline: [],
  };
}

test("execution fixture materializers build the first execution trace", () => {
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
    FIXTURE_TRACE_OPERATION.MAIN_AGENT_INITIALIZATION,
    FIXTURE_TRACE_OPERATION.EXECUTION_REPORT,
  ]) {
    EXECUTION_FIXTURE_TRACE_APPENDERS[operation](trace, taskPackage, runtime);
  }

  assert.deepEqual(
    taskPackage.timeline.map((event) => event.artifactType ?? event.agentRunId),
    [
      "executionIntent",
      "executionAuthorization",
      "isolatedWorkspace",
      "main-agent:initialization",
      "executionReport",
      "execution-agent:001",
    ],
  );
  assert.equal(taskPackage.artifacts.executionReport[0].body.cwd, ".workflow/worktrees/tasks/stub-execution-agent");
  assert.equal(taskPackage.agentRuns.at(-1).runId, "execution-agent:001");
});

test("execution fixture materializers expose only execution operation appenders", () => {
  assert.deepEqual(Object.keys(EXECUTION_FIXTURE_TRACE_APPENDERS), [
    FIXTURE_TRACE_OPERATION.EXECUTION_INTENT,
    FIXTURE_TRACE_OPERATION.EXECUTION_AUTHORIZATION,
    FIXTURE_TRACE_OPERATION.ISOLATED_WORKSPACE,
    FIXTURE_TRACE_OPERATION.MAIN_AGENT_INITIALIZATION,
    FIXTURE_TRACE_OPERATION.EXECUTION_REPORT,
    FIXTURE_TRACE_OPERATION.GUIDED_EXECUTION_AGENT_RUN,
  ]);
});
