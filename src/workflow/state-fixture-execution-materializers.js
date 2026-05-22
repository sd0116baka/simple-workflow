import {
  EXECUTION_PREPARATION_FIXTURE_TRACE_APPENDERS,
} from "./state-fixture-execution-preparation-materializers.js";
import {
  EXECUTION_RUN_FIXTURE_TRACE_APPENDERS,
} from "./state-fixture-execution-run-materializers.js";

export const EXECUTION_FIXTURE_TRACE_APPENDERS = Object.freeze({
  ...EXECUTION_PREPARATION_FIXTURE_TRACE_APPENDERS,
  ...EXECUTION_RUN_FIXTURE_TRACE_APPENDERS,
});
