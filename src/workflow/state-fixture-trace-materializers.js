import { EXECUTION_FIXTURE_TRACE_APPENDERS } from "./state-fixture-execution-materializers.js";
import { REVIEW_FIXTURE_TRACE_APPENDERS } from "./state-fixture-review-materializers.js";
import { CONVERGENCE_FIXTURE_TRACE_APPENDERS } from "./state-fixture-convergence-materializers.js";
import { HUMAN_DECISION_FIXTURE_TRACE_APPENDERS } from "./state-fixture-human-decision-materializers.js";
import { AUTO_MERGE_FIXTURE_TRACE_APPENDERS } from "./state-fixture-auto-merge-materializers.js";
import { TERMINAL_FIXTURE_TRACE_APPENDERS } from "./state-fixture-terminal-materializers.js";

const OPERATION_APPENDERS = Object.freeze({
  ...EXECUTION_FIXTURE_TRACE_APPENDERS,
  ...REVIEW_FIXTURE_TRACE_APPENDERS,
  ...CONVERGENCE_FIXTURE_TRACE_APPENDERS,
  ...HUMAN_DECISION_FIXTURE_TRACE_APPENDERS,
  ...AUTO_MERGE_FIXTURE_TRACE_APPENDERS,
  ...TERMINAL_FIXTURE_TRACE_APPENDERS,
});

export function materializeFixtureTracePlan(trace, taskPackage, {
  id,
  plan,
  timestamp,
}) {
  for (const operation of plan.operations) {
    const appendOperation = OPERATION_APPENDERS[operation];
    if (!appendOperation) {
      throw new Error(`Unsupported fixture trace operation: ${operation}`);
    }
    appendOperation(trace, taskPackage, { id, plan, timestamp });
  }
}
