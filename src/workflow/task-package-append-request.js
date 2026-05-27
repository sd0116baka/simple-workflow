import { cloneJsonValue } from "./json-value.js";
import { appendArtifact } from "./task-package-artifact-append.js";
import { updateTaskModuleStatesForAppend } from "./module-status.js";

function normalizeAgentRun(agentRun, artifactId) {
  if (!agentRun) return null;
  return {
    ...cloneJsonValue(agentRun),
    outputArtifactRefs: artifactId ? [artifactId] : [],
  };
}

export function applyAppendRequestToTaskPackage(
  taskPackage,
  appendRequest,
  { currentWorkStage, now = () => new Date().toISOString() } = {},
) {
  const appendedAt = appendRequest.artifact?.appendedAt
    ?? appendRequest.agentRun?.finishedAt
    ?? now();
  const { artifacts, artifactId } = appendArtifact(
    taskPackage.artifacts,
    appendRequest,
    appendedAt,
  );
  const agentRun = normalizeAgentRun(appendRequest.agentRun, artifactId);
  const modules = updateTaskModuleStatesForAppend({
    modules: taskPackage.modules,
    appendRequest: {
      ...appendRequest,
      agentRun,
    },
    artifactId,
    appendedAt,
  });
  return {
    ...taskPackage,
    currentWorkStage: currentWorkStage ?? taskPackage.currentWorkStage,
    artifacts,
    modules,
    agentRuns: agentRun
      ? [...taskPackage.agentRuns, agentRun]
      : taskPackage.agentRuns,
    timeline: [
      ...taskPackage.timeline,
      {
        artifactType: appendRequest.artifactType ?? null,
        artifactId,
        agentRunId: agentRun?.runId ?? null,
        appendedAt,
      },
    ],
  };
}
