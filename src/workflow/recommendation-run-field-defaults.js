export const RECOMMENDATION_RUN_FIELD_CLONE_GROUPS = Object.freeze({
  jsonOrNull: Object.freeze([
    "executionIntent",
    "executionIntentAppendRequest",
    "executionAdmission",
    "isolatedWorkspaceAllocation",
    "mainAgentInitialization",
    "successHumanDecisionRequest",
    "failureHumanDecisionRequest",
    "humanConvergenceGuidance",
    "taskCancellation",
    "autoMergePlanning",
    "autoMergeExecution",
    "autoMergeHumanDecisionRequest",
    "taskCloseout",
    "taskContextPackage",
  ]),
  jsonArray: Object.freeze([
    "executionAgentRuns",
    "reviewAgentRuns",
    "convergenceRuns",
  ]),
  stringArray: Object.freeze([
    "executionAgentErrors",
    "reviewAgentErrors",
    "convergenceErrors",
  ]),
  scalarDefaults: Object.freeze({
    executionIntentError: null,
    isolatedWorkspaceError: null,
    mainAgentInitializationError: null,
    successHumanDecisionError: null,
    failureHumanDecisionError: null,
    humanConvergenceGuidanceError: null,
    taskCancellationError: null,
    autoMergePlanningError: null,
    autoMergeExecutionError: null,
    autoMergeHumanDecisionError: null,
    taskCloseoutError: null,
    stdout: "",
    stderr: "",
    exitCode: null,
    terminalSessionId: null,
  }),
});

export function createEmptyRecommendationRunFields() {
  const fields = {
    progress: [],
    ...RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.scalarDefaults,
  };
  for (const fieldName of RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.jsonOrNull) {
    fields[fieldName] = null;
  }
  for (const fieldName of RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.jsonArray) {
    fields[fieldName] = [];
  }
  for (const fieldName of RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.stringArray) {
    fields[fieldName] = [];
  }
  return fields;
}
