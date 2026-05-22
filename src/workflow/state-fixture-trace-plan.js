import {
  isConvergenceFailureFixtureScenario,
  operationsForHumanDecisionScenario,
} from "./state-fixture-human-decision-scenario-trace.js";
import { operationsForWorkflowStage } from "./state-fixture-stage-trace-operations.js";

export { isConvergenceFailureFixtureScenario };

export function buildFixtureTracePlan({
  currentWorkStage,
  humanDecisionScenario = null,
}) {
  const operations = operationsForHumanDecisionScenario(humanDecisionScenario)
    ?? operationsForWorkflowStage(currentWorkStage);
  return {
    currentWorkStage,
    humanDecisionScenario,
    resetBeforeReplay: currentWorkStage === "cancelled",
    operations: [...operations],
  };
}
