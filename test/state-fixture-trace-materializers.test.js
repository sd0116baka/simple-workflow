import { test } from "node:test";
import assert from "node:assert/strict";
import { createStateFixtureTraceRecorder } from "../src/workflow/state-fixture-trace-recorder.js";
import {
  FIXTURE_TRACE_OPERATION,
} from "../src/workflow/state-fixture-trace-operations.js";
import {
  materializeFixtureTracePlan,
} from "../src/workflow/state-fixture-trace-materializers.js";

function fixturePackage() {
  return {
    packageId: "task-context-package:tasks/stub-execution-intent.yaml",
    taskDraft: {
      goal: "用于测试 execution intent materializer。",
      acceptanceCriteria: ["记录 executionIntent artifact"],
    },
    fixture: {
      baseCommit: "abc123",
    },
    artifacts: {},
    agentRuns: [],
    timeline: [],
  };
}

test("fixture trace materializer applies operation appenders through the recorder", () => {
  const taskPackage = fixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);

  materializeFixtureTracePlan(trace, taskPackage, {
    id: "stub-execution-intent",
    plan: {
      operations: [FIXTURE_TRACE_OPERATION.EXECUTION_INTENT],
    },
    timestamp: "2026-05-21T00:00:00.000Z",
  });

  assert.equal(taskPackage.artifacts.executionIntent.artifactId, "executionIntent");
  assert.equal(
    taskPackage.artifacts.executionIntent.body.recommendedPackageId,
    "task-context-package:tasks/stub-execution-intent.yaml",
  );
  assert.deepEqual(taskPackage.timeline, [
    {
      artifactType: "executionIntent",
      artifactId: "executionIntent",
      agentRunId: null,
      appendedAt: "2026-05-21T00:00:00.000Z",
    },
  ]);
});

test("fixture trace materializer composes execution, review, and convergence appenders", () => {
  const taskPackage = fixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);

  materializeFixtureTracePlan(trace, taskPackage, {
    id: "stub-execution-agent",
    plan: {
      operations: [
        FIXTURE_TRACE_OPERATION.EXECUTION_INTENT,
        FIXTURE_TRACE_OPERATION.EXECUTION_AUTHORIZATION,
        FIXTURE_TRACE_OPERATION.ISOLATED_WORKSPACE,
        FIXTURE_TRACE_OPERATION.MAIN_AGENT_INITIALIZATION,
        FIXTURE_TRACE_OPERATION.EXECUTION_REPORT,
        FIXTURE_TRACE_OPERATION.REVIEW_REPORT,
        FIXTURE_TRACE_OPERATION.CONVERGENCE_FAILURE,
      ],
    },
    timestamp: "2026-05-21T00:00:00.000Z",
  });

  assert.deepEqual(
    taskPackage.timeline.map((event) => event.artifactType ?? event.agentRunId),
    [
      "executionIntent",
      "executionAuthorization",
      "isolatedWorkspace",
      "main-agent:initialization",
      "executionReport",
      "execution-agent:001",
      "reviewReport",
      "review-agent:001",
      "convergenceFailure",
      "main-agent:convergence:001",
    ],
  );
  assert.equal(taskPackage.artifacts.reviewReport[0].body.outcome, "failed");
  assert.equal(taskPackage.artifacts.convergenceFailure[0].body.reasonCode, "fixture-not-converged");
});

test("fixture trace materializer rejects unsupported operations", () => {
  const taskPackage = fixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);

  assert.throws(
    () => materializeFixtureTracePlan(trace, taskPackage, {
      id: "stub-unknown",
      plan: {
        operations: ["unknownOperation"],
      },
      timestamp: "2026-05-21T00:00:00.000Z",
    }),
    /Unsupported fixture trace operation: unknownOperation/,
  );
});
