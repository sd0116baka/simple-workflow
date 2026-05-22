import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isConvergenceFailureFixtureScenario,
  operationsForHumanDecisionScenario,
} from "../src/workflow/state-fixture-human-decision-scenario-trace.js";
import { FIXTURE_TRACE_OPERATION } from "../src/workflow/state-fixture-trace-operations.js";

const {
  CONVERGENCE_FAILURE,
  CONVERGENCE_FAILURE_DECISION_REQUEST,
  HUMAN_CONVERGENCE_GUIDANCE,
  GUIDED_EXECUTION_AGENT_RUN,
} = FIXTURE_TRACE_OPERATION;

test("human decision scenario trace exposes convergence failure scenarios only", () => {
  assert.equal(isConvergenceFailureFixtureScenario("convergence-failure"), true);
  assert.equal(isConvergenceFailureFixtureScenario("human-guided-execution"), true);
  assert.equal(isConvergenceFailureFixtureScenario("convergence-success"), false);
});

test("human decision scenario trace builds convergence failure decision trace", () => {
  assert.deepEqual(operationsForHumanDecisionScenario("convergence-failure").slice(-2), [
    CONVERGENCE_FAILURE,
    CONVERGENCE_FAILURE_DECISION_REQUEST,
  ]);
});

test("human decision scenario trace preserves human-guided execution as fixture scenario", () => {
  assert.deepEqual(operationsForHumanDecisionScenario("human-guided-execution").slice(-4), [
    CONVERGENCE_FAILURE,
    CONVERGENCE_FAILURE_DECISION_REQUEST,
    HUMAN_CONVERGENCE_GUIDANCE,
    GUIDED_EXECUTION_AGENT_RUN,
  ]);
});

test("human decision scenario trace does not replace normal stage traces", () => {
  assert.equal(operationsForHumanDecisionScenario(null), null);
  assert.equal(operationsForHumanDecisionScenario("convergence-success"), null);
});
