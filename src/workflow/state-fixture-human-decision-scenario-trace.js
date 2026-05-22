import { FIXTURE_TRACE_OPERATION } from "./state-fixture-trace-operations.js";
import { FIRST_REVIEW_TRACE } from "./state-fixture-stage-trace-operations.js";

const {
  CONVERGENCE_FAILURE,
  CONVERGENCE_FAILURE_DECISION_REQUEST,
  HUMAN_CONVERGENCE_GUIDANCE,
  GUIDED_EXECUTION_AGENT_RUN,
} = FIXTURE_TRACE_OPERATION;

const CONVERGENCE_FAILURE_TRACE = Object.freeze([
  ...FIRST_REVIEW_TRACE,
  CONVERGENCE_FAILURE,
  CONVERGENCE_FAILURE_DECISION_REQUEST,
]);

export function isConvergenceFailureFixtureScenario(scenario) {
  return ["convergence-failure", "human-guided-execution"].includes(scenario);
}

export function operationsForHumanDecisionScenario(scenario) {
  if (scenario === "human-guided-execution") {
    return [
      ...CONVERGENCE_FAILURE_TRACE,
      HUMAN_CONVERGENCE_GUIDANCE,
      GUIDED_EXECUTION_AGENT_RUN,
    ];
  }
  if (scenario === "convergence-failure") {
    return CONVERGENCE_FAILURE_TRACE;
  }
  return null;
}
