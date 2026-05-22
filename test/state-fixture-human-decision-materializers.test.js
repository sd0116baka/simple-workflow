import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStateFixtureTraceRecorder,
} from "../src/workflow/state-fixture-trace-recorder.js";
import {
  FIXTURE_TRACE_OPERATION,
} from "../src/workflow/state-fixture-trace-operations.js";
import {
  HUMAN_DECISION_FIXTURE_TRACE_APPENDERS,
} from "../src/workflow/state-fixture-human-decision-materializers.js";

function guidedDecisionPackage() {
  return {
    packageId: "task-context-package:tasks/stub-human-guided-execution.yaml",
    fixture: {
      baseCommit: "abc123",
    },
    artifacts: {
      convergenceFailure: [
        {
          artifactId: "convergenceFailure:001",
          body: {
            summary: "fixture convergence failure",
          },
          appendedAt: "2026-05-21T00:00:00.000Z",
        },
      ],
    },
    agentRuns: [],
    timeline: [],
  };
}

test("human decision fixture materializers build failure request and guidance trace", () => {
  const taskPackage = guidedDecisionPackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);
  const runtime = {
    id: "stub-human-guided-execution",
    timestamp: "2026-05-21T00:00:00.000Z",
  };

  HUMAN_DECISION_FIXTURE_TRACE_APPENDERS[
    FIXTURE_TRACE_OPERATION.CONVERGENCE_FAILURE_DECISION_REQUEST
  ](trace, taskPackage, runtime);
  HUMAN_DECISION_FIXTURE_TRACE_APPENDERS[
    FIXTURE_TRACE_OPERATION.HUMAN_CONVERGENCE_GUIDANCE
  ](trace, taskPackage, runtime);

  assert.equal(taskPackage.artifacts.humanDecisionRequest.body.targetRef, "convergenceFailure:001");
  assert.equal(
    taskPackage.artifacts.humanConvergenceGuidance[0].body.targetRef,
    "convergenceFailure:001",
  );
  assert.deepEqual(
    taskPackage.timeline.map((event) => event.artifactType),
    ["humanDecisionRequest", "humanConvergenceGuidance"],
  );
});

test("human decision fixture materializers expose only human decision operation appenders", () => {
  assert.deepEqual(Object.keys(HUMAN_DECISION_FIXTURE_TRACE_APPENDERS), [
    FIXTURE_TRACE_OPERATION.CONVERGENCE_FAILURE_DECISION_REQUEST,
    FIXTURE_TRACE_OPERATION.HUMAN_CONVERGENCE_GUIDANCE,
    FIXTURE_TRACE_OPERATION.CONVERGENCE_SUCCESS_DECISION_REQUEST,
    FIXTURE_TRACE_OPERATION.ACCEPT_CONVERGENCE_DECISION,
  ]);
});
