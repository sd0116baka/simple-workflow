export const MAIN_AGENT_INITIALIZATION_RUN_ID = "main-agent:initialization";
export const MAIN_AGENT_INITIALIZATION_INPUT_REFS = [
  "taskDraft",
  "executionIntent",
  "executionAuthorization",
];

export function buildMainAgentInitializationRequest({
  taskContextPackage,
  session,
  startedAt,
  finishedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    agentRun: {
      runId: MAIN_AGENT_INITIALIZATION_RUN_ID,
      role: "main",
      sessionId: session.sessionId,
      inputArtifactRefs: [...MAIN_AGENT_INITIALIZATION_INPUT_REFS],
      outputArtifactRefs: [],
      status: session.status,
      startedAt,
      finishedAt,
    },
  };
}
