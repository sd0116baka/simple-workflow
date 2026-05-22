import { test } from "node:test";
import assert from "node:assert/strict";
import { createManualWorkflowActionTargets } from "../src/workflow/manual-workflow-action-targets.js";

function createTargets() {
  const latestRecommendationRun = {
    id: "recommendation-run-1",
  };
  const calls = [];
  const taskContextWorkspace = {};
  for (const method of [
    "findAcceptableTaskContextPackage",
    "findAutoMergePlannablePackage",
    "findGuidableConvergenceDecisionPackage",
    "findCancellableHumanDecisionPackage",
  ]) {
    taskContextWorkspace[method] = async (options) => {
      calls.push({
        method,
        options,
      });
      return {
        packageId: `${method}:result`,
      };
    };
  }
  const targets = createManualWorkflowActionTargets({
    taskContextWorkspace,
    getLatestRecommendationRun: () => latestRecommendationRun,
  });
  return {
    calls,
    targets,
    latestRecommendationRun,
  };
}

test("manual workflow action targets pass latest run and package id to each selector", async () => {
  const { calls, latestRecommendationRun, targets } = createTargets();

  assert.deepEqual(await targets.findAcceptableTaskContextPackage("pkg-1"), {
    packageId: "findAcceptableTaskContextPackage:result",
  });
  assert.deepEqual(await targets.findAutoMergePlannablePackage("pkg-2"), {
    packageId: "findAutoMergePlannablePackage:result",
  });
  assert.deepEqual(await targets.findGuidableConvergenceDecisionPackage("pkg-3"), {
    packageId: "findGuidableConvergenceDecisionPackage:result",
  });
  assert.deepEqual(await targets.findCancellableHumanDecisionPackage("pkg-4"), {
    packageId: "findCancellableHumanDecisionPackage:result",
  });

  assert.deepEqual(calls, [
    {
      method: "findAcceptableTaskContextPackage",
      options: {
        latestRecommendationRun,
        packageId: "pkg-1",
      },
    },
    {
      method: "findAutoMergePlannablePackage",
      options: {
        latestRecommendationRun,
        packageId: "pkg-2",
      },
    },
    {
      method: "findGuidableConvergenceDecisionPackage",
      options: {
        latestRecommendationRun,
        packageId: "pkg-3",
      },
    },
    {
      method: "findCancellableHumanDecisionPackage",
      options: {
        latestRecommendationRun,
        packageId: "pkg-4",
      },
    },
  ]);
});
