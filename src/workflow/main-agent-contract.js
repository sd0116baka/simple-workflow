import { buildAgentRunRecord } from "./agent-session-contract.js";

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
    agentRun: buildAgentRunRecord({
      runId: MAIN_AGENT_INITIALIZATION_RUN_ID,
      role: "main",
      session,
      inputArtifactRefs: [...MAIN_AGENT_INITIALIZATION_INPUT_REFS],
      startedAt,
      finishedAt,
    }),
  };
}
