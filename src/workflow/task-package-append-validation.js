const FORBIDDEN_AGENT_RUN_FIELDS = Object.freeze([
  "command",
  "conversation",
  "cwd",
  "events",
  "messages",
  "pid",
  "processEvents",
  "progress",
  "progressEvents",
  "prompt",
  "rawOutput",
  "stderr",
  "stdout",
  "terminalOutput",
  "transcript",
]);

function validateAgentRun(agentRun) {
  for (const field of FORBIDDEN_AGENT_RUN_FIELDS) {
    if (Object.hasOwn(agentRun, field)) {
      throw new Error(`appendRequest.agentRun.${field} is runtime debug data and must not be persisted`);
    }
  }
  for (const field of ["runId", "role", "sessionId", "status", "startedAt", "finishedAt"]) {
    if (!agentRun[field]) {
      throw new Error(`appendRequest.agentRun.${field} is required`);
    }
  }
  if (!["main", "execution", "review"].includes(agentRun.role)) {
    throw new Error("appendRequest.agentRun.role must be main, execution, or review");
  }
  if (!Array.isArray(agentRun.inputArtifactRefs)) {
    throw new Error("appendRequest.agentRun.inputArtifactRefs must be an array");
  }
  if (!Array.isArray(agentRun.outputArtifactRefs)) {
    throw new Error("appendRequest.agentRun.outputArtifactRefs must be an array");
  }
}

export function assertAppendRequest(appendRequest) {
  if (!appendRequest?.packageId) {
    throw new Error("appendRequest.packageId is required");
  }
  const hasArtifact = Boolean(appendRequest.artifactType);
  const hasAgentRun = Boolean(appendRequest.agentRun);
  if (!hasArtifact && !hasAgentRun) {
    throw new Error("appendRequest requires artifact or agentRun");
  }
  if (hasArtifact && (typeof appendRequest.artifact !== "object" || appendRequest.artifact === null)) {
    throw new Error("appendRequest.artifact must be an object");
  }
  if (hasAgentRun && (typeof appendRequest.agentRun !== "object" || appendRequest.agentRun === null)) {
    throw new Error("appendRequest.agentRun must be an object");
  }
  if (hasAgentRun) {
    validateAgentRun(appendRequest.agentRun);
  }
}
