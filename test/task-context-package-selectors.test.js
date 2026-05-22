import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findAcceptableTaskContextPackage,
  findActiveWork,
  findAutoMergePlannablePackage,
  findCancellableHumanDecisionPackage,
  findGuidableConvergenceDecisionPackage,
} from "../src/workflow/task-context-package-selectors.js";

function packageFixture({
  packageId = "task-context-package:tasks/task-001.yaml",
  currentWorkStage = "task-pool",
  decisionOptions = [],
} = {}) {
  return {
    packageId,
    currentWorkStage,
    source: { path: "tasks/task-001.yaml" },
    taskDraft: { name: "测试任务" },
    artifacts: decisionOptions.length
      ? {
          humanDecisionRequest: {
            artifactId: "humanDecisionRequest",
            body: { decisionOptions },
          },
        }
      : {},
    agentRuns: [],
    timeline: [],
  };
}

test("task context package selectors find active work from package stages", () => {
  const activeWork = findActiveWork([
    packageFixture({ currentWorkStage: "task-pool" }),
    packageFixture({
      packageId: "task-context-package:tasks/task-002.yaml",
      currentWorkStage: "execution-agent",
    }),
  ]);

  assert.deepEqual(activeWork, {
    packageId: "task-context-package:tasks/task-002.yaml",
    currentWorkStage: "execution-agent",
    taskName: "测试任务",
    sourcePath: "tasks/task-001.yaml",
  });
});

test("task context package selectors prefer the latest in-memory package when it is valid", () => {
  const latestPackage = packageFixture({
    packageId: "task-context-package:tasks/latest.yaml",
    currentWorkStage: "human-decision",
    decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
  });
  const storedPackage = packageFixture({
    packageId: "task-context-package:tasks/stored.yaml",
    currentWorkStage: "human-decision",
    decisionOptions: ["accept-convergence"],
  });
  const latestRecommendationRun = { taskContextPackage: latestPackage };

  assert.equal(
    findAcceptableTaskContextPackage({
      taskContextPackages: [storedPackage],
      latestRecommendationRun,
    }),
    latestPackage,
  );
  assert.equal(
    findGuidableConvergenceDecisionPackage({
      taskContextPackages: [storedPackage],
      latestRecommendationRun,
    }),
    latestPackage,
  );
  assert.equal(
    findCancellableHumanDecisionPackage({
      taskContextPackages: [storedPackage],
      latestRecommendationRun,
    }),
    latestPackage,
  );
});

test("task context package selectors ignore malformed single artifact shapes", () => {
  const malformedDecisionRequest = packageFixture({
    packageId: "task-context-package:tasks/malformed-request.yaml",
    currentWorkStage: "human-decision",
    decisionOptions: ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"],
  });
  malformedDecisionRequest.artifacts.humanDecisionRequest = [
    malformedDecisionRequest.artifacts.humanDecisionRequest,
  ];
  const validAcceptablePackage = packageFixture({
    packageId: "task-context-package:tasks/valid-request.yaml",
    currentWorkStage: "human-decision",
    decisionOptions: ["accept-convergence"],
  });

  assert.equal(
    findAcceptableTaskContextPackage({
      taskContextPackages: [malformedDecisionRequest, validAcceptablePackage],
    }),
    validAcceptablePackage,
  );
  assert.equal(
    findGuidableConvergenceDecisionPackage({
      taskContextPackages: [malformedDecisionRequest],
    }),
    null,
  );
  assert.equal(
    findCancellableHumanDecisionPackage({
      taskContextPackages: [malformedDecisionRequest],
    }),
    null,
  );

  const malformedAutoMergePackage = packageFixture({
    packageId: "task-context-package:tasks/malformed-auto-merge.yaml",
    currentWorkStage: "auto-merge-planning",
  });
  malformedAutoMergePackage.artifacts.humanDecision = [
    {
      artifactId: "humanDecision",
      body: { decision: "accept-convergence" },
    },
  ];
  assert.equal(
    findAutoMergePlannablePackage({
      taskContextPackages: [malformedAutoMergePackage],
    }),
    null,
  );
});
