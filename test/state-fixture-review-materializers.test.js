import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStateFixtureTraceRecorder,
} from "../src/workflow/state-fixture-trace-recorder.js";
import {
  FIXTURE_TRACE_OPERATION,
} from "../src/workflow/state-fixture-trace-operations.js";
import {
  REVIEW_FIXTURE_TRACE_APPENDERS,
} from "../src/workflow/state-fixture-review-materializers.js";

function reviewFixturePackage() {
  return {
    packageId: "task-context-package:tasks/stub-review.yaml",
    taskDraft: {
      goal: "用于测试 review materializer。",
      acceptanceCriteria: ["记录 review trace artifacts"],
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
    },
    agentRuns: [],
    timeline: [],
  };
}

test("review fixture materializer records a passed review report", () => {
  const taskPackage = reviewFixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);
  const runtime = {
    id: "stub-review",
    plan: {
      operations: [FIXTURE_TRACE_OPERATION.REVIEW_REPORT],
    },
    timestamp: "2026-05-21T00:00:00.000Z",
  };

  REVIEW_FIXTURE_TRACE_APPENDERS[FIXTURE_TRACE_OPERATION.REVIEW_REPORT](
    trace,
    taskPackage,
    runtime,
  );

  assert.equal(taskPackage.artifacts.reviewReport[0].artifactId, "reviewReport:001");
  assert.equal(taskPackage.artifacts.reviewReport[0].body.outcome, "passed");
  assert.deepEqual(taskPackage.artifacts.reviewReport[0].body.findings, []);
  assert.equal(taskPackage.agentRuns.at(-1).runId, "review-agent:001");
  assert.deepEqual(taskPackage.agentRuns.at(-1).inputArtifactRefs, [
    "taskDraft",
    "executionAuthorization",
    "isolatedWorkspace",
    "executionReport:001",
  ]);
  assert.deepEqual(
    taskPackage.timeline.map((event) => event.artifactType ?? event.agentRunId),
    ["reviewReport", "review-agent:001"],
  );
});

test("review fixture materializer records failed review when convergence failure is planned", () => {
  const taskPackage = reviewFixturePackage();
  const trace = createStateFixtureTraceRecorder(taskPackage);
  const runtime = {
    id: "stub-review",
    plan: {
      operations: [
        FIXTURE_TRACE_OPERATION.REVIEW_REPORT,
        FIXTURE_TRACE_OPERATION.CONVERGENCE_FAILURE,
      ],
    },
    timestamp: "2026-05-21T00:00:00.000Z",
  };

  REVIEW_FIXTURE_TRACE_APPENDERS[FIXTURE_TRACE_OPERATION.REVIEW_REPORT](
    trace,
    taskPackage,
    runtime,
  );

  assert.equal(taskPackage.artifacts.reviewReport[0].body.outcome, "failed");
  assert.deepEqual(taskPackage.artifacts.reviewReport[0].body.findings, [
    { code: "fixture-not-converged", message: "用于测试收敛失败人工处理。" },
  ]);
});

test("review fixture materializers expose only review operation appenders", () => {
  assert.deepEqual(Object.keys(REVIEW_FIXTURE_TRACE_APPENDERS), [
    FIXTURE_TRACE_OPERATION.REVIEW_REPORT,
  ]);
});
