import { createEmptyRecommendationRunFields } from "../../src/workflow/recommendation-run-field-defaults.js";

export function createRecommendationRunFixture(overrides = {}) {
  return {
    id: "recommendation-run-1",
    status: "running",
    prompt: "recommend a task",
    command: "opencode",
    args: ["run"],
    startupCheck: {
      canStartWork: true,
      findings: [],
    },
    ...createEmptyRecommendationRunFields(),
    ...overrides,
  };
}

export function createRunningRecommendationRunFixture(overrides = {}) {
  return createRecommendationRunFixture({
    status: "running",
    ...overrides,
  });
}

export function createSucceededRecommendationRunFixture(overrides = {}) {
  return createRecommendationRunFixture({
    status: "succeeded",
    finishedAt: "2026-05-22T10:00:00.000Z",
    ...overrides,
  });
}
