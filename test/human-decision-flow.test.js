import { test } from "node:test";
import assert from "node:assert/strict";
import { requestHumanDecisionForTaskCompletion } from "../src/workflow/human-decision-flow.js";

function completedPackage() {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    artifacts: {
      taskCompletion: {
        artifactId: "taskCompletion",
        body: {
          summary: "stub task completed",
        },
        appendedAt: "2026-05-18T10:00:06.000Z",
      },
    },
  };
}

test("requests human decision after task completion", () => {
  const result = requestHumanDecisionForTaskCompletion({
    taskContextPackage: completedPackage(),
    now: () => "2026-05-18T10:00:07.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(result.appendRequest.artifact.requestedAt, "2026-05-18T10:00:07.000Z");
  assert.equal(result.appendRequest.artifact.taskCompletionRef, "taskCompletion");
  assert.deepEqual(result.appendRequest.artifact.decisionOptions, [
    "accept-completion",
    "request-changes",
  ]);
});

test("does not request human decision before task completion exists", () => {
  const taskPackage = completedPackage();
  delete taskPackage.artifacts.taskCompletion;

  const result = requestHumanDecisionForTaskCompletion({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 taskCompletion/);
});
