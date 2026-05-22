import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowPageDataControllerHarness,
  createWorkflowPageTaskContextPackage,
} from "./support/workflow-page-data-controller-fixtures.js";

test("workflow page data controller loads recommendation run and tracks sync freshness", async () => {
  const recommendationRun = {
    id: "recommendation-run:001",
    status: "running",
    taskContextPackage: createWorkflowPageTaskContextPackage({ sourcePath: "tasks/run.yaml" }),
  };
  const harness = createWorkflowPageDataControllerHarness({ recommendationRun });

  await harness.controller.loadRecommendationRun();

  assert.equal(harness.controller.isRecommendationRunRunning(), true);
  assert.equal(harness.controller.latestRecommendationSyncAt() > 0, true);
  assert.deepEqual(harness.calls, [
    ["loadRecommendationRun"],
    [
      "renderRecommendationRun",
      "recommendation-run:001",
      0,
      "task-context-package:tasks/task-001.yaml",
    ],
  ]);
});

test("workflow page data controller marks running recommendation connection interruptions", async () => {
  const harness = createWorkflowPageDataControllerHarness();
  harness.workflowApi.loadRecommendationRun = async () => {
    throw new Error("offline");
  };
  harness.controller.setRecommendationRun({
    id: "recommendation-run:001",
    status: "running",
    startedAt: new Date().toISOString(),
  });

  assert.equal(harness.controller.markRecommendationConnectionInterrupted(), true);
  assert.match(harness.elements.recommendationStatus.textContent, /^running · 连接中断 · /);

  harness.elements.recommendationStatus.textContent = "";
  await harness.controller.syncRecommendationRunSilently();
  assert.match(harness.elements.recommendationStatus.textContent, /^running · 连接中断 · /);
});
