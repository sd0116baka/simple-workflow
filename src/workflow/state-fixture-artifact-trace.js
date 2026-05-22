import { createStateFixtureTraceRecorder } from "./state-fixture-trace-recorder.js";
import { buildFixtureTracePlan } from "./state-fixture-trace-plan.js";
import { materializeFixtureTracePlan } from "./state-fixture-trace-materializers.js";

export function buildFixtureArtifactTrace(taskPackage, {
  id,
  currentWorkStage,
  humanDecisionScenario,
  timestamp,
}) {
  const trace = createStateFixtureTraceRecorder(taskPackage);
  const plan = buildFixtureTracePlan({
    currentWorkStage,
    humanDecisionScenario,
  });

  if (plan.resetBeforeReplay) trace.reset();
  materializeFixtureTracePlan(trace, taskPackage, {
    id,
    plan,
    timestamp,
  });
}
