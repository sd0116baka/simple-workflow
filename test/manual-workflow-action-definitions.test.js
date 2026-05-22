import { test } from "node:test";
import assert from "node:assert/strict";
import { createManualWorkflowActionDefinitions } from "../src/workflow/manual-workflow-action-definitions.js";

function createDefinitions(overrides = {}) {
  return createManualWorkflowActionDefinitions({
    repositoryDir: "repo",
    runExecutionAgentSession: async () => "execution-session",
    runReviewAgentSession: async () => "review-session",
    runConvergenceSession: async () => "convergence-session",
    findAcceptableTaskContextPackage: async () => null,
    findAutoMergePlannablePackage: async () => null,
    findGuidableConvergenceDecisionPackage: async () => null,
    findCancellableHumanDecisionPackage: async () => null,
    applyAppendRequest: async () => null,
    acceptConvergenceAction: async () => ({ shouldEmit: false }),
    replanAutoMergeAction: async () => ({ shouldEmit: false }),
    continueConvergenceAction: async () => ({ shouldEmit: false }),
    cancelTaskAction: async () => ({ shouldEmit: false }),
    ...overrides,
  });
}

test("manual workflow action definitions compose auto merge replan definition", () => {
  const findAutoMergePlannablePackage = async () => "package";
  const applyAppendRequest = async () => "append";
  const replanAutoMergeAction = async () => "replan";
  const replanAutoMergeDefinition = ({ packageId }) => ({
    packageId,
    marker: "replan",
  });
  let receivedOptions = null;
  const definitions = createDefinitions({
    findAutoMergePlannablePackage,
    applyAppendRequest,
    replanAutoMergeAction,
    createReplanAutoMergeDefinition(options) {
      receivedOptions = options;
      return replanAutoMergeDefinition;
    },
  });

  assert.deepEqual(
    definitions.replanAutoMerge({ packageId: "task-context-package:tasks/task-001.yaml" }),
    {
      packageId: "task-context-package:tasks/task-001.yaml",
      marker: "replan",
    },
  );
  assert.equal(receivedOptions.repositoryDir, "repo");
  assert.equal(receivedOptions.findAutoMergePlannablePackage, findAutoMergePlannablePackage);
  assert.equal(receivedOptions.applyAppendRequest, applyAppendRequest);
  assert.equal(receivedOptions.replanAutoMergeAction, replanAutoMergeAction);
});

test("continue convergence definition injects guidance payload and session adapters", async () => {
  const taskContextPackage = { packageId: "task-context-package:tasks/task-001.yaml" };
  const recommendationRun = { id: "manual-workflow-action" };
  const runExecutionAgentSession = async () => "execution";
  const runReviewAgentSession = async () => "review";
  const runConvergenceSession = async () => "convergence";
  let actionArgs = null;
  const definitions = createDefinitions({
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    continueConvergenceAction: async (args) => {
      actionArgs = args;
      return {
        shouldEmit: true,
        response: { continued: true, error: null },
      };
    },
  });

  const definition = definitions.continueConvergenceWithGuidance({
    packageId: taskContextPackage.packageId,
    guidance: "继续收敛",
    focusAreas: ["状态"],
    avoidRepeating: ["重复路径"],
    expectedNextOutcome: "下一轮通过",
  });
  const result = await definition.run({ taskContextPackage, recommendationRun });

  assert.deepEqual(result.response, { continued: true, error: null });
  assert.equal(actionArgs.taskContextPackage, taskContextPackage);
  assert.equal(actionArgs.recommendationRun, recommendationRun);
  assert.equal(actionArgs.guidance, "继续收敛");
  assert.deepEqual(actionArgs.focusAreas, ["状态"]);
  assert.deepEqual(actionArgs.avoidRepeating, ["重复路径"]);
  assert.equal(actionArgs.expectedNextOutcome, "下一轮通过");
  assert.equal(actionArgs.repositoryDir, "repo");
  assert.equal(actionArgs.runExecutionAgentSession, runExecutionAgentSession);
  assert.equal(actionArgs.runReviewAgentSession, runReviewAgentSession);
  assert.equal(actionArgs.runConvergenceSession, runConvergenceSession);
});
