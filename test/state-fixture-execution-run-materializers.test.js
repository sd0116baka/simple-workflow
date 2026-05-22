import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStateFixtureTraceRecorder,
} from "../src/workflow/state-fixture-trace-recorder.js";
import {
  EXECUTION_RUN_FIXTURE_TRACE_APPENDERS,
} from "../src/workflow/state-fixture-execution-run-materializers.js";
import {
  FIXTURE_TRACE_OPERATION,
} from "../src/workflow/state-fixture-trace-operations.js";

function executionFixturePackage() {
  return {
    packageId: "task-context-package:tasks/stub-execution-agent.yaml",
    taskDraft: {
      goal: "用于测试 execution run materializer。",
      acceptanceCriteria: ["记录 execution run artifacts"],
    },
    fixture: {
      baseCommit: "abc123",
    },
    artifacts: {
      executionIntent: { artifactId: "executionIntent", body: {}, appendedAt: "t" },
      executionAuthorization: { artifactId: "executionAuthorization", body: {}, appendedAt: "t" },
      isolatedWorkspace: { artifactId: "isolatedWorkspace", body: {}, appendedAt: "t" },
    },
    agentRuns: [],
    timeline: [],
  };
}

test("execution run materializers build main initialization and execution report trace", () => {
  const taskPackage = executionFixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);
  const runtime = {
    id: "stub-execution-agent",
    timestamp: "2026-05-21T00:00:00.000Z",
  };

  for (const operation of [
    FIXTURE_TRACE_OPERATION.MAIN_AGENT_INITIALIZATION,
    FIXTURE_TRACE_OPERATION.EXECUTION_REPORT,
  ]) {
    EXECUTION_RUN_FIXTURE_TRACE_APPENDERS[operation](trace, taskPackage, runtime);
  }

  assert.deepEqual(
    taskPackage.timeline.map((event) => event.artifactType ?? event.agentRunId),
    ["main-agent:initialization", "executionReport", "execution-agent:001"],
  );
  assert.equal(taskPackage.agentRuns[0].runId, "main-agent:initialization");
  assert.equal(taskPackage.agentRuns[1].runId, "execution-agent:001");
  assert.deepEqual(taskPackage.agentRuns[1].inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "isolatedWorkspace",
  ]);
});

test("execution run materializers build guided execution running trace", () => {
  const taskPackage = executionFixturePackage();
  taskPackage.artifacts.executionReport = [
    { artifactId: "executionReport:001", body: {}, appendedAt: "t" },
  ];
  const trace = createStateFixtureTraceRecorder(taskPackage);

  EXECUTION_RUN_FIXTURE_TRACE_APPENDERS[FIXTURE_TRACE_OPERATION.GUIDED_EXECUTION_AGENT_RUN](
    trace,
    taskPackage,
    {
      id: "human-guided-execution",
      timestamp: "2026-05-21T00:00:00.000Z",
    },
  );

  assert.equal(taskPackage.agentRuns[0].runId, "execution-agent:002");
  assert.equal(taskPackage.agentRuns[0].status, "running");
  assert.equal(taskPackage.timeline[0].agentRunId, "execution-agent:002");
});

test("execution run materializer table exposes only execution run operations", () => {
  assert.deepEqual(Object.keys(EXECUTION_RUN_FIXTURE_TRACE_APPENDERS), [
    FIXTURE_TRACE_OPERATION.MAIN_AGENT_INITIALIZATION,
    FIXTURE_TRACE_OPERATION.EXECUTION_REPORT,
    FIXTURE_TRACE_OPERATION.GUIDED_EXECUTION_AGENT_RUN,
  ]);
});
