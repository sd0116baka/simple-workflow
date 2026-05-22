import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeTaskContextPackage,
  findSelectedTask,
  fixtureSelectedFileName,
  mergeRecommendationTaskContextPackage,
  selectionAfterFixtureCleanup,
  selectExistingTaskFile,
} from "../public/workflow-page-state.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

const task = (fileName) => ({ fileName, format: "yaml" });

const taskPackage = ({
  packageId = "task-context-package:tasks/task-001.yaml",
  sourcePath = "tasks/task-001.yaml",
  stage = "task-pool",
  artifacts = {},
} = {}) => createTaskContextPackageFixture({
  packageId,
  currentWorkStage: stage,
  source: { path: sourcePath },
  artifacts,
});

test("workflow page state keeps a valid selected task and falls back to the first task", () => {
  const tasks = [task("task-001.yaml"), task("task-002.yaml")];

  assert.equal(selectExistingTaskFile(tasks, "task-002.yaml"), "task-002.yaml");
  assert.equal(selectExistingTaskFile(tasks, "missing.yaml"), "task-001.yaml");
  assert.equal(selectExistingTaskFile([], "task-001.yaml"), null);
  assert.deepEqual(findSelectedTask(tasks, "task-001.yaml"), task("task-001.yaml"));
  assert.equal(findSelectedTask(tasks, "missing.yaml"), null);
});

test("workflow page state resolves the active task context package by UI priority", () => {
  const selected = taskPackage();
  const runPackage = taskPackage({
    packageId: "task-context-package:tasks/run.yaml",
    sourcePath: "tasks/run.yaml",
    stage: "execution-agent",
  });
  const humanDecisionPackage = taskPackage({
    packageId: "task-context-package:tasks/human.yaml",
    sourcePath: "tasks/human.yaml",
    stage: "human-decision",
    artifacts: { humanDecisionRequest: { body: { reason: "需要人工判断" } } },
  });

  assert.equal(activeTaskContextPackage({
    selectedFileName: "task-001.yaml",
    poolTaskContextPackages: [humanDecisionPackage, selected],
    recommendationRun: { taskContextPackage: runPackage },
  }), selected);
  assert.equal(activeTaskContextPackage({
    selectedFileName: "missing.yaml",
    poolTaskContextPackages: [humanDecisionPackage],
    recommendationRun: { taskContextPackage: runPackage },
  }), runPackage);
  assert.equal(activeTaskContextPackage({
    selectedFileName: "missing.yaml",
    poolTaskContextPackages: [humanDecisionPackage],
    recommendationRun: null,
  }), humanDecisionPackage);
  assert.equal(activeTaskContextPackage({
    selectedFileName: "missing.yaml",
    poolTaskContextPackages: [
      taskPackage({
        packageId: "task-context-package:tasks/malformed.yaml",
        sourcePath: "tasks/malformed.yaml",
        stage: "human-decision",
        artifacts: { humanDecisionRequest: [{ body: { reason: "数组不是 single artifact" } }] },
      }),
    ],
    recommendationRun: null,
  }), null);
});

test("workflow page state merges recommendation task packages back into the pool", () => {
  const stale = taskPackage({ stage: "human-decision" });
  const fresh = taskPackage({ stage: "auto-merge-planning" });
  const other = taskPackage({
    packageId: "task-context-package:tasks/task-002.yaml",
    sourcePath: "tasks/task-002.yaml",
  });
  const pool = [stale, other];

  const merged = mergeRecommendationTaskContextPackage({
    poolTaskContextPackages: pool,
    recommendationRun: { taskContextPackage: fresh },
  });

  assert.notEqual(merged, pool);
  assert.equal(merged[0], fresh);
  assert.equal(merged[1], other);
  assert.equal(mergeRecommendationTaskContextPackage({
    poolTaskContextPackages: pool,
    recommendationRun: { taskContextPackage: taskPackage({ packageId: "missing" }) },
  }), pool);
  assert.equal(mergeRecommendationTaskContextPackage({
    poolTaskContextPackages: pool,
    recommendationRun: null,
  }), pool);
});

test("workflow page state derives fixture selections", () => {
  assert.equal(fixtureSelectedFileName({
    tasks: [{ sourcePath: "tasks/stub-convergence-success.yaml" }],
  }, "task-001.yaml"), "stub-convergence-success.yaml");
  assert.equal(fixtureSelectedFileName({}, "task-001.yaml"), "task-001.yaml");
  assert.equal(selectionAfterFixtureCleanup("stub-convergence-success.yaml"), null);
  assert.equal(selectionAfterFixtureCleanup("task-001.yaml"), "task-001.yaml");
});
