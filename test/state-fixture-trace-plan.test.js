import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFixtureTracePlan,
  isConvergenceFailureFixtureScenario,
} from "../src/workflow/state-fixture-trace-plan.js";
import {
  FIXTURE_TRACE_OPERATION,
} from "../src/workflow/state-fixture-trace-operations.js";

const {
  EXECUTION_INTENT,
  EXECUTION_AUTHORIZATION,
  ISOLATED_WORKSPACE,
  MAIN_AGENT_INITIALIZATION,
  EXECUTION_REPORT,
  REVIEW_REPORT,
  CONVERGENCE_ADVICE,
  CONVERGENCE_FAILURE,
  CONVERGENCE_FAILURE_DECISION_REQUEST,
  HUMAN_CONVERGENCE_GUIDANCE,
  GUIDED_EXECUTION_AGENT_RUN,
  CONVERGENCE_SUCCESS,
  CONVERGENCE_SUCCESS_DECISION_REQUEST,
  ACCEPT_CONVERGENCE_DECISION,
  AUTO_MERGE_PLAN,
  AUTO_MERGE_RESULT,
  MERGED_TASK_CLOSEOUT,
  CANCELLED_CONVERGENCE_FAILURE,
  CANCEL_TASK_DECISION_REQUEST,
  CANCEL_TASK_DECISION,
  CANCELLED_TASK_CLOSEOUT,
} = FIXTURE_TRACE_OPERATION;

test("fixture trace plan exposes stage operation prefixes", () => {
  assert.deepEqual(buildFixtureTracePlan({ currentWorkStage: "task-pool" }).operations, []);
  assert.deepEqual(buildFixtureTracePlan({ currentWorkStage: "task-recommender" }).operations, [
    EXECUTION_INTENT,
  ]);
  assert.deepEqual(buildFixtureTracePlan({ currentWorkStage: "execution-agent" }).operations, [
    EXECUTION_INTENT,
    EXECUTION_AUTHORIZATION,
    ISOLATED_WORKSPACE,
    MAIN_AGENT_INITIALIZATION,
    EXECUTION_REPORT,
  ]);
  assert.deepEqual(buildFixtureTracePlan({ currentWorkStage: "human-decision" }).operations, [
    EXECUTION_INTENT,
    EXECUTION_AUTHORIZATION,
    ISOLATED_WORKSPACE,
    MAIN_AGENT_INITIALIZATION,
    EXECUTION_REPORT,
    REVIEW_REPORT,
    CONVERGENCE_ADVICE,
    CONVERGENCE_SUCCESS,
    CONVERGENCE_SUCCESS_DECISION_REQUEST,
  ]);
  assert.deepEqual(buildFixtureTracePlan({ currentWorkStage: "closed" }).operations.at(-3), AUTO_MERGE_PLAN);
  assert.deepEqual(buildFixtureTracePlan({ currentWorkStage: "closed" }).operations.at(-2), AUTO_MERGE_RESULT);
  assert.deepEqual(buildFixtureTracePlan({ currentWorkStage: "closed" }).operations.at(-1), MERGED_TASK_CLOSEOUT);
});

test("fixture trace plan keeps convergence failure scenarios explicit", () => {
  const failurePlan = buildFixtureTracePlan({
    currentWorkStage: "human-decision",
    humanDecisionScenario: "convergence-failure",
  });

  assert.equal(isConvergenceFailureFixtureScenario("convergence-failure"), true);
  assert.equal(isConvergenceFailureFixtureScenario("human-guided-execution"), true);
  assert.equal(isConvergenceFailureFixtureScenario("convergence-success"), false);
  assert.deepEqual(failurePlan.operations.slice(-2), [
    CONVERGENCE_FAILURE,
    CONVERGENCE_FAILURE_DECISION_REQUEST,
  ]);
});

test("fixture trace plan preserves human-guided execution as a linear repeated execution trace", () => {
  const plan = buildFixtureTracePlan({
    currentWorkStage: "execution-agent",
    humanDecisionScenario: "human-guided-execution",
  });

  assert.deepEqual(plan.operations.slice(-4), [
    CONVERGENCE_FAILURE,
    CONVERGENCE_FAILURE_DECISION_REQUEST,
    HUMAN_CONVERGENCE_GUIDANCE,
    GUIDED_EXECUTION_AGENT_RUN,
  ]);
  assert.equal(plan.operations.at(-1), GUIDED_EXECUTION_AGENT_RUN);
  assert.equal(plan.resetBeforeReplay, false);
});

test("fixture trace plan models cancellation as a replacement closeout trace", () => {
  const plan = buildFixtureTracePlan({ currentWorkStage: "cancelled" });

  assert.equal(plan.resetBeforeReplay, true);
  assert.deepEqual(plan.operations, [
    CANCELLED_CONVERGENCE_FAILURE,
    CANCEL_TASK_DECISION_REQUEST,
    CANCEL_TASK_DECISION,
    CANCELLED_TASK_CLOSEOUT,
  ]);
});
