import {
  agentSessionFailure,
  normalizeAgentProcessStatus as normalizeProcessStatus,
} from "./agent-failure-model.js";

export function createAgentSessionRequest({
  role,
  packageId,
  taskContextPackage,
  runId = null,
  sessionId = null,
  inputArtifactRefs = [],
  cwd = null,
  onProgress,
  signal,
} = {}) {
  const request = {
    role,
    packageId,
    taskContextPackage,
    runId,
    inputArtifactRefs: [...inputArtifactRefs],
  };

  if (sessionId) {
    request.sessionId = sessionId;
  }
  if (cwd) {
    request.cwd = cwd;
  }
  if (onProgress) {
    request.onProgress = onProgress;
  }
  if (signal) {
    request.signal = signal;
  }

  return request;
}

export function createStubAgentSession({ role, packageId }) {
  return {
    sessionId: `stub-${role}-session:${packageId}`,
    status: "succeeded",
  };
}

export function normalizeAgentProcessStatus(input = {}) {
  return normalizeProcessStatus(input);
}

export function buildAgentRunRecord({
  runId,
  role,
  session,
  inputArtifactRefs,
  outputArtifactRefs = [],
  startedAt,
  finishedAt,
}) {
  const failure = agentSessionFailure({ ...session, role });
  return {
    runId,
    role,
    sessionId: session.sessionId,
    inputArtifactRefs,
    outputArtifactRefs,
    status: session.status ?? normalizeProcessStatus({ failure }),
    startedAt,
    finishedAt,
    ...(failure ? { failure } : {}),
  };
}

export function buildAgentRunAppendRequest({
  taskContextPackage,
  runId,
  role,
  session,
  inputArtifactRefs,
  startedAt,
  finishedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    agentRun: buildAgentRunRecord({
      runId,
      role,
      session,
      inputArtifactRefs,
      startedAt,
      finishedAt,
    }),
  };
}

export { agentSessionFailure, agentSessionErrorMessage } from "./agent-failure-model.js";
export { buildAgentProcessFailure } from "./agent-failure-model.js";
