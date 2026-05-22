import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextConvergenceAgentRunId,
  nextExecutionAgentRunId,
  nextReviewAgentRunId,
} from "../src/workflow/agent-run-ids.js";
import {
  createArtifactRecordFixture as record,
  createTaskContextPackageFixture,
} from "./support/task-context-package-fixtures.js";

test("builds first agent run ids when no prior reports exist", () => {
  const taskPackage = createTaskContextPackageFixture();

  assert.equal(nextExecutionAgentRunId(taskPackage), "execution-agent:001");
  assert.equal(nextReviewAgentRunId(taskPackage), "review-agent:001");
  assert.equal(nextConvergenceAgentRunId(taskPackage), "main-agent:convergence:001");
});

test("increments execution and review run ids from report counts", () => {
  const taskPackage = createTaskContextPackageFixture({
    artifacts: {
      executionReport: [
        record("executionReport:001"),
        record("executionReport:002"),
      ],
      reviewReport: [
        record("reviewReport:001"),
      ],
    },
  });

  assert.equal(nextExecutionAgentRunId(taskPackage), "execution-agent:003");
  assert.equal(nextReviewAgentRunId(taskPackage), "review-agent:002");
});

test("increments convergence run ids from advice count", () => {
  const taskPackage = createTaskContextPackageFixture({
    artifacts: {
      convergenceAdvice: [
        record("convergenceAdvice:001"),
        record("convergenceAdvice:002"),
      ],
      convergenceFailure: [
        record("convergenceFailure:001"),
      ],
    },
  });

  assert.equal(nextConvergenceAgentRunId(taskPackage), "main-agent:convergence:003");
});
