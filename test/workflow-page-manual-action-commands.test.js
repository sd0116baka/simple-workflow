import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageManualActionCommands } from "../public/workflow-page-manual-action-commands.js";

function createActionButton() {
  return {
    dataset: {},
    disabled: false,
    textContent: "",
    closest() {
      return {
        querySelector() {
          return { textContent: "" };
        },
      };
    },
  };
}

function createHarness() {
  const calls = [];
  const workflowApi = {
    async acceptConvergence(payload) {
      calls.push(["acceptConvergence", payload]);
      return { recommendationRun: { id: "manual-run:accept" } };
    },
    async continueConvergenceWithGuidance(payload) {
      calls.push(["continueConvergenceWithGuidance", payload]);
      return { recommendationRun: { id: "manual-run:continue" } };
    },
    async cancelTask(payload) {
      calls.push(["cancelTask", payload]);
      return { recommendationRun: { id: "manual-run:cancel" } };
    },
  };
  const commands = createWorkflowPageManualActionCommands({
    workflowApi,
    activeTaskContextPackage: () => ({
      packageId: "task-context-package:tasks/task-001.yaml",
    }),
    setRecommendationRun: (run, options) => calls.push(["setRecommendationRun", run, options]),
    renderRecommendationRun: () => calls.push(["renderRecommendationRun"]),
    loadTasks: async () => calls.push(["loadTasks"]),
    pageStatus: {
      setHumanDecisionStatus: (text) => calls.push(["setHumanDecisionStatus", text]),
    },
  });

  return {
    calls,
    commands,
  };
}

test("workflow page manual action commands accept convergence and sync the run", async () => {
  const harness = createHarness();

  await harness.commands.acceptConvergence(createActionButton());

  assert.deepEqual(harness.calls, [
    ["setHumanDecisionStatus", "提交中"],
    ["acceptConvergence", { packageId: "task-context-package:tasks/task-001.yaml" }],
    ["setRecommendationRun", { id: "manual-run:accept" }, { syncTaskPackage: true }],
    ["renderRecommendationRun"],
    ["loadTasks"],
  ]);
});

test("workflow page manual action commands continue convergence with guidance", async () => {
  const harness = createHarness();

  await harness.commands.continueConvergenceWithGuidance({
    guidance: "继续修正",
    expectedNextOutcome: "success",
    actionButton: createActionButton(),
  });

  assert.deepEqual(harness.calls, [
    ["setHumanDecisionStatus", "继续中"],
    [
      "continueConvergenceWithGuidance",
      {
        packageId: "task-context-package:tasks/task-001.yaml",
        guidance: "继续修正",
        expectedNextOutcome: "success",
      },
    ],
    ["setRecommendationRun", { id: "manual-run:continue" }, { syncTaskPackage: true }],
    ["renderRecommendationRun"],
    ["loadTasks"],
  ]);
});

test("workflow page manual action commands cancel a task", async () => {
  const harness = createHarness();

  await harness.commands.cancelTask(createActionButton());

  assert.deepEqual(harness.calls, [
    ["setHumanDecisionStatus", "取消中"],
    ["cancelTask", { packageId: "task-context-package:tasks/task-001.yaml" }],
    ["setRecommendationRun", { id: "manual-run:cancel" }, { syncTaskPackage: true }],
    ["renderRecommendationRun"],
    ["loadTasks"],
  ]);
});
