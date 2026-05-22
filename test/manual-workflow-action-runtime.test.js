import { test } from "node:test";
import assert from "node:assert/strict";
import { createManualWorkflowActionRuntime } from "../src/workflow/manual-workflow-action-runtime.js";

function createRuntimeHarness() {
  const calls = [];
  const actionDefinitions = {
    acceptConvergenceSuccess(input) {
      calls.push(["acceptConvergenceSuccess", input]);
      return { action: "accept", input };
    },
    replanAutoMerge(input) {
      calls.push(["replanAutoMerge", input]);
      return { action: "replan", input };
    },
    continueConvergenceWithGuidance(input) {
      calls.push(["continueConvergenceWithGuidance", input]);
      return { action: "continue", input };
    },
    cancelTask(input) {
      calls.push(["cancelTask", input]);
      return { action: "cancel", input };
    },
  };
  const actionProtocol = {
    async runManualWorkflowAction(actionDefinition) {
      calls.push(["runManualWorkflowAction", actionDefinition]);
      return { completedAction: actionDefinition.action };
    },
  };

  return {
    calls,
    runtime: createManualWorkflowActionRuntime({
      actionDefinitions,
      actionProtocol,
    }),
  };
}

test("manual workflow action runtime delegates actions with default inputs", async () => {
  const { calls, runtime } = createRuntimeHarness();

  assert.deepEqual(await runtime.acceptConvergenceSuccess(), { completedAction: "accept" });
  assert.deepEqual(await runtime.replanAutoMerge(), { completedAction: "replan" });
  assert.deepEqual(await runtime.continueConvergenceWithGuidance(), { completedAction: "continue" });
  assert.deepEqual(await runtime.cancelTask(), { completedAction: "cancel" });

  assert.deepEqual(calls, [
    ["acceptConvergenceSuccess", { packageId: null }],
    ["runManualWorkflowAction", { action: "accept", input: { packageId: null } }],
    ["replanAutoMerge", { packageId: null }],
    ["runManualWorkflowAction", { action: "replan", input: { packageId: null } }],
    [
      "continueConvergenceWithGuidance",
      {
        packageId: null,
        guidance: "",
        focusAreas: [],
        avoidRepeating: [],
        expectedNextOutcome: "",
      },
    ],
    [
      "runManualWorkflowAction",
      {
        action: "continue",
        input: {
          packageId: null,
          guidance: "",
          focusAreas: [],
          avoidRepeating: [],
          expectedNextOutcome: "",
        },
      },
    ],
    ["cancelTask", { packageId: null }],
    ["runManualWorkflowAction", { action: "cancel", input: { packageId: null } }],
  ]);
});

test("manual workflow action runtime delegates actions with provided inputs", async () => {
  const { calls, runtime } = createRuntimeHarness();

  await runtime.acceptConvergenceSuccess({ packageId: "pkg-1" });
  await runtime.replanAutoMerge({ packageId: "pkg-2" });
  await runtime.continueConvergenceWithGuidance({
    packageId: "pkg-3",
    guidance: "继续收窄执行范围。",
    focusAreas: ["tests"],
    avoidRepeating: ["重复假设"],
    expectedNextOutcome: "证明修复路径。",
  });
  await runtime.cancelTask({ packageId: "pkg-4" });

  assert.deepEqual(calls, [
    ["acceptConvergenceSuccess", { packageId: "pkg-1" }],
    ["runManualWorkflowAction", { action: "accept", input: { packageId: "pkg-1" } }],
    ["replanAutoMerge", { packageId: "pkg-2" }],
    ["runManualWorkflowAction", { action: "replan", input: { packageId: "pkg-2" } }],
    [
      "continueConvergenceWithGuidance",
      {
        packageId: "pkg-3",
        guidance: "继续收窄执行范围。",
        focusAreas: ["tests"],
        avoidRepeating: ["重复假设"],
        expectedNextOutcome: "证明修复路径。",
      },
    ],
    [
      "runManualWorkflowAction",
      {
        action: "continue",
        input: {
          packageId: "pkg-3",
          guidance: "继续收窄执行范围。",
          focusAreas: ["tests"],
          avoidRepeating: ["重复假设"],
          expectedNextOutcome: "证明修复路径。",
        },
      },
    ],
    ["cancelTask", { packageId: "pkg-4" }],
    ["runManualWorkflowAction", { action: "cancel", input: { packageId: "pkg-4" } }],
  ]);
});
