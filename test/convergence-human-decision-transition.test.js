import { test } from "node:test";
import assert from "node:assert/strict";
import { requestHumanDecisionForTerminalConvergence } from "../src/workflow/convergence-human-decision-transition.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

function taskPackage() {
  return createTaskContextPackageFixture({
    currentWorkStage: "convergence",
  });
}

function convergenceRun(artifactType) {
  return {
    appendRequest: {
      artifactType,
    },
  };
}

test("terminal convergence success requests human decision and appends it", async () => {
  const applied = [];
  const result = await requestHumanDecisionForTerminalConvergence({
    taskContextPackage: taskPackage(),
    convergenceRun: convergenceRun("convergenceSuccess"),
    now: () => "2026-05-21T10:00:00.000Z",
    requestSuccessHumanDecision: ({ taskContextPackage, now }) => ({
      appendRequest: {
        packageId: taskContextPackage.packageId,
        artifactType: "humanDecisionRequest",
        artifact: {
          requestedAt: now(),
          targetRef: "convergenceSuccess",
        },
      },
      error: null,
    }),
    applyAppendRequest: async (appendRequest, { currentWorkStage }) => {
      applied.push([appendRequest.artifactType, currentWorkStage]);
      return {
        packageId: appendRequest.packageId,
        currentWorkStage,
      };
    },
  });

  assert.deepEqual(applied, [["humanDecisionRequest", "human-decision"]]);
  assert.equal(result.taskContextPackage.currentWorkStage, "human-decision");
  assert.equal(result.successHumanDecisionRequest.appendRequest.artifact.targetRef, "convergenceSuccess");
  assert.equal(result.failureHumanDecisionRequest, null);
});

test("terminal convergence failure requests failure human decision", async () => {
  const result = await requestHumanDecisionForTerminalConvergence({
    taskContextPackage: taskPackage(),
    convergenceRun: convergenceRun("convergenceFailure"),
    requestFailureHumanDecision: ({ taskContextPackage }) => ({
      appendRequest: {
        packageId: taskContextPackage.packageId,
        artifactType: "humanDecisionRequest",
        artifact: {
          targetRef: "convergenceFailure:001",
        },
      },
      error: null,
    }),
    applyAppendRequest: async (appendRequest, { currentWorkStage }) => ({
      packageId: appendRequest.packageId,
      currentWorkStage,
    }),
  });

  assert.equal(result.successHumanDecisionRequest, null);
  assert.equal(result.failureHumanDecisionRequest.appendRequest.artifact.targetRef, "convergenceFailure:001");
  assert.equal(result.taskContextPackage.currentWorkStage, "human-decision");
});

test("non-terminal convergence leaves human decision unchanged", async () => {
  let applied = false;
  const originalPackage = taskPackage();
  const result = await requestHumanDecisionForTerminalConvergence({
    taskContextPackage: originalPackage,
    convergenceRun: convergenceRun("convergenceAdvice"),
    applyAppendRequest: async () => {
      applied = true;
    },
  });

  assert.equal(applied, false);
  assert.equal(result.taskContextPackage, originalPackage);
  assert.equal(result.successHumanDecisionRequest, null);
  assert.equal(result.failureHumanDecisionRequest, null);
});
