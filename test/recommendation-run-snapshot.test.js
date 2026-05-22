import { test } from "node:test";
import assert from "node:assert/strict";
import { toRecommendationSnapshot } from "../src/workflow/recommendation-run-snapshot.js";

test("recommendation run snapshot clones mutable nested state", () => {
  const run = {
    id: "recommendation-run-1",
    status: "succeeded",
    args: ["run"],
    startupCheck: { canStartWork: true },
    progress: [{ message: "ready" }],
    executionAgentRuns: [{ runId: "execution-agent:001" }],
    executionAgentErrors: ["execution failed"],
    reviewAgentRuns: [{ runId: "review-agent:001" }],
    reviewAgentErrors: ["review failed"],
    convergenceRuns: [{ runId: "convergence-agent:001" }],
    convergenceErrors: ["convergence failed"],
    taskContextPackage: {
      packageId: "task-context-package:tasks/task-001.yaml",
      artifacts: {},
    },
  };

  const snapshot = toRecommendationSnapshot(run);
  snapshot.args.push("changed");
  snapshot.progress[0].message = "changed";
  snapshot.executionAgentRuns[0].runId = "changed";
  snapshot.executionAgentErrors.push("changed");
  snapshot.taskContextPackage.packageId = "changed";

  assert.deepEqual(run.args, ["run"]);
  assert.equal(run.progress[0].message, "ready");
  assert.equal(run.executionAgentRuns[0].runId, "execution-agent:001");
  assert.deepEqual(run.executionAgentErrors, ["execution failed"]);
  assert.equal(run.taskContextPackage.packageId, "task-context-package:tasks/task-001.yaml");
});

test("recommendation run snapshot fills optional fields with read defaults", () => {
  const snapshot = toRecommendationSnapshot({
    id: "recommendation-run-1",
    status: "running",
    args: [],
    progress: [],
  });

  assert.deepEqual(snapshot.executionAgentRuns, []);
  assert.deepEqual(snapshot.reviewAgentRuns, []);
  assert.deepEqual(snapshot.convergenceRuns, []);
  assert.equal(snapshot.executionIntent, null);
  assert.equal(snapshot.autoMergePlanning, null);
  assert.equal(snapshot.taskContextPackage, null);
  assert.equal(snapshot.taskCloseoutError, null);
  assert.equal(snapshot.stdout, "");
  assert.equal(snapshot.stderr, "");
  assert.equal(snapshot.exitCode, null);
});

test("recommendation run snapshot uses fresh field default collections", () => {
  const first = toRecommendationSnapshot({
    id: "recommendation-run-1",
    status: "running",
  });
  const second = toRecommendationSnapshot({
    id: "recommendation-run-2",
    status: "running",
  });

  first.progress.push({ message: "changed" });
  first.executionAgentRuns.push({ runId: "execution-agent:001" });

  assert.deepEqual(second.progress, []);
  assert.deepEqual(second.executionAgentRuns, []);
});

test("recommendation run snapshot returns null for missing run", () => {
  assert.equal(toRecommendationSnapshot(null), null);
});
