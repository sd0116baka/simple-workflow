import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agentCorrectionInputRefs,
} from "../src/workflow/agent-correction-refs.js";
import {
  createArtifactRecordFixture as record,
  createTaskContextPackageFixture,
} from "./support/task-context-package-fixtures.js";

test("agent correction refs separate automatic advice from human correction refs", () => {
  const taskPackage = createTaskContextPackageFixture({
    artifacts: {
      convergenceAdvice: [record("convergenceAdvice:001")],
      convergenceFailure: [record("convergenceFailure:001")],
      humanConvergenceGuidance: [record("humanConvergenceGuidance:001")],
    },
  });

  assert.deepEqual(agentCorrectionInputRefs(taskPackage), {
    automaticAdviceRefs: ["convergenceAdvice:001"],
    humanCorrectionRefs: ["convergenceFailure:001", "humanConvergenceGuidance:001"],
    allCorrectionRefs: [
      "convergenceAdvice:001",
      "convergenceFailure:001",
      "humanConvergenceGuidance:001",
    ],
  });
});

test("agent correction refs ignore missing correction artifacts", () => {
  assert.deepEqual(agentCorrectionInputRefs(createTaskContextPackageFixture()), {
    automaticAdviceRefs: [],
    humanCorrectionRefs: [],
    allCorrectionRefs: [],
  });
});
