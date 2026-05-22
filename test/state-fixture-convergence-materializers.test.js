import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStateFixtureTraceRecorder,
} from "../src/workflow/state-fixture-trace-recorder.js";
import {
  FIXTURE_TRACE_OPERATION,
} from "../src/workflow/state-fixture-trace-operations.js";
import {
  CONVERGENCE_FIXTURE_TRACE_APPENDERS,
} from "../src/workflow/state-fixture-convergence-materializers.js";

function convergenceFixturePackage() {
  return {
    packageId: "task-context-package:tasks/stub-convergence.yaml",
    taskDraft: {
      goal: "用于测试 convergence materializer。",
      acceptanceCriteria: ["记录 convergence trace artifacts"],
    },
    fixture: {
      baseCommit: "abc123",
    },
    artifacts: {
      executionReport: [
        {
          artifactId: "executionReport:001",
          body: {
            status: "completed",
            summary: "fixture execution report",
          },
          appendedAt: "2026-05-21T00:00:00.000Z",
        },
      ],
      reviewReport: [
        {
          artifactId: "reviewReport:001",
          body: {
            outcome: "failed",
            findings: [{ code: "fixture-review-finding", message: "fixture finding" }],
          },
          appendedAt: "2026-05-21T00:00:00.000Z",
        },
      ],
    },
    agentRuns: [],
    timeline: [],
  };
}

function convergenceRuntime() {
  return {
    id: "stub-convergence",
    timestamp: "2026-05-21T00:00:00.000Z",
  };
}

test("convergence fixture materializer records a failure and main agent run", () => {
  const taskPackage = convergenceFixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);

  CONVERGENCE_FIXTURE_TRACE_APPENDERS[FIXTURE_TRACE_OPERATION.CONVERGENCE_FAILURE](
    trace,
    taskPackage,
    convergenceRuntime(),
  );

  assert.equal(taskPackage.artifacts.convergenceFailure[0].artifactId, "convergenceFailure:001");
  assert.equal(taskPackage.artifacts.convergenceFailure[0].body.reasonCode, "fixture-not-converged");
  assert.deepEqual(taskPackage.artifacts.convergenceFailure[0].body.basisRefs, [
    "executionReport:001",
    "reviewReport:001",
  ]);
  assert.deepEqual(taskPackage.artifacts.convergenceFailure[0].body.unresolvedIssues, [
    { code: "fixture-review-finding", message: "fixture finding" },
  ]);
  assert.equal(taskPackage.agentRuns.at(-1).runId, "main-agent:convergence:001");
  assert.deepEqual(taskPackage.agentRuns.at(-1).outputArtifactRefs, ["convergenceFailure:001"]);
});

test("convergence fixture materializer records advice and main agent run", () => {
  const taskPackage = convergenceFixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);

  CONVERGENCE_FIXTURE_TRACE_APPENDERS[FIXTURE_TRACE_OPERATION.CONVERGENCE_ADVICE](
    trace,
    taskPackage,
    convergenceRuntime(),
  );

  assert.equal(taskPackage.artifacts.convergenceAdvice[0].artifactId, "convergenceAdvice:001");
  assert.equal(taskPackage.artifacts.convergenceAdvice[0].body.nextAction, "继续下一轮测试。");
  assert.deepEqual(taskPackage.artifacts.convergenceAdvice[0].body.basis, [
    "executionReport:001",
    "reviewReport:001",
  ]);
  assert.equal(taskPackage.agentRuns.at(-1).runId, "main-agent:convergence:001");
  assert.deepEqual(taskPackage.agentRuns.at(-1).outputArtifactRefs, ["convergenceAdvice:001"]);
});

test("convergence fixture materializer records success as a single artifact", () => {
  const taskPackage = convergenceFixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);

  CONVERGENCE_FIXTURE_TRACE_APPENDERS[FIXTURE_TRACE_OPERATION.CONVERGENCE_SUCCESS](
    trace,
    taskPackage,
    convergenceRuntime(),
  );

  assert.equal(taskPackage.artifacts.convergenceSuccess.artifactId, "convergenceSuccess");
  assert.equal(taskPackage.artifacts.convergenceSuccess.body.summary, "fixture task completed");
  assert.deepEqual(taskPackage.artifacts.convergenceSuccess.body.basis, [
    "executionReport:001",
    "reviewReport:001",
  ]);
  assert.deepEqual(taskPackage.agentRuns, []);
  assert.deepEqual(
    taskPackage.timeline.map((event) => event.artifactType ?? event.agentRunId),
    ["convergenceSuccess"],
  );
});

test("convergence fixture materializers expose only convergence operation appenders", () => {
  assert.deepEqual(Object.keys(CONVERGENCE_FIXTURE_TRACE_APPENDERS), [
    FIXTURE_TRACE_OPERATION.CONVERGENCE_ADVICE,
    FIXTURE_TRACE_OPERATION.CONVERGENCE_FAILURE,
    FIXTURE_TRACE_OPERATION.CONVERGENCE_SUCCESS,
  ]);
});
