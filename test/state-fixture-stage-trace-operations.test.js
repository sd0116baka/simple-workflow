import { test } from "node:test";
import assert from "node:assert/strict";
import { operationsForWorkflowStage } from "../src/workflow/state-fixture-stage-trace-operations.js";
import { FIXTURE_TRACE_OPERATION } from "../src/workflow/state-fixture-trace-operations.js";

const {
  EXECUTION_INTENT,
  EXECUTION_AUTHORIZATION,
  ISOLATED_WORKSPACE,
  MAIN_AGENT_INITIALIZATION,
  EXECUTION_REPORT,
  REVIEW_REPORT,
  CONVERGENCE_ADVICE,
  CONVERGENCE_SUCCESS,
  CONVERGENCE_SUCCESS_DECISION_REQUEST,
  AUTO_MERGE_PLAN,
  AUTO_MERGE_RESULT,
  MERGED_TASK_CLOSEOUT,
  CANCELLED_CONVERGENCE_FAILURE,
  CANCEL_TASK_DECISION_REQUEST,
  CANCEL_TASK_DECISION,
  CANCELLED_TASK_CLOSEOUT,
} = FIXTURE_TRACE_OPERATION;

test("fixture stage trace operations expose formal workflow stage prefixes", () => {
  assert.deepEqual(operationsForWorkflowStage("task-pool"), []);
  assert.deepEqual(operationsForWorkflowStage("execution-agent"), [
    EXECUTION_INTENT,
    EXECUTION_AUTHORIZATION,
    ISOLATED_WORKSPACE,
    MAIN_AGENT_INITIALIZATION,
    EXECUTION_REPORT,
  ]);
  assert.deepEqual(operationsForWorkflowStage("human-decision"), [
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
  assert.deepEqual(operationsForWorkflowStage("closed").slice(-3), [
    AUTO_MERGE_PLAN,
    AUTO_MERGE_RESULT,
    MERGED_TASK_CLOSEOUT,
  ]);
});

test("fixture stage trace operations keep cancellation as a replacement trace", () => {
  assert.deepEqual(operationsForWorkflowStage("cancelled"), [
    CANCELLED_CONVERGENCE_FAILURE,
    CANCEL_TASK_DECISION_REQUEST,
    CANCEL_TASK_DECISION,
    CANCELLED_TASK_CLOSEOUT,
  ]);
});

test("fixture stage trace operations ignore fixture scenario names as stages", () => {
  assert.deepEqual(operationsForWorkflowStage("human-guided-execution"), []);
});
