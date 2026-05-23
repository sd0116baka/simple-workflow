import { test } from "node:test";
import assert from "node:assert/strict";
import { runningTaskContextPackageFromRecommendationRun } from "../public/recommendation-run-running-package.js";

test("running package projection maps execution progress to execution-agent stage", () => {
  const taskContextPackage = runningTaskContextPackageFromRecommendationRun({
    status: "running",
    executionIntentAppendRequest: {
      packageId: "task-context-package:tasks/task-001.yaml",
    },
    progress: [
      {
        type: "execution_process_start",
        message: "启动 execution-agent:001：opencode run --format json",
      },
    ],
  });

  assert.equal(taskContextPackage.packageId, "task-context-package:tasks/task-001.yaml");
  assert.equal(taskContextPackage.currentWorkStage, "execution-agent");
  assert.equal(taskContextPackage.source.path, "tasks/task-001.yaml");
  assert.equal(taskContextPackage.runtime.status, "running");
});

test("running package projection maps main convergence progress to convergence stage", () => {
  const taskContextPackage = runningTaskContextPackageFromRecommendationRun({
    status: "running",
    executionIntent: {
      recommendedPackageId: "task-context-package:tasks/task-001.yaml",
    },
    progress: [
      {
        type: "main_process_start",
        message: "启动 main-agent:convergence:001：opencode run --format json",
      },
    ],
  });

  assert.equal(taskContextPackage.currentWorkStage, "convergence");
});

test("running package projection ignores non-running runs", () => {
  assert.equal(runningTaskContextPackageFromRecommendationRun({
    status: "succeeded",
    progress: [
      { type: "execution_process_start" },
    ],
  }), null);
});
