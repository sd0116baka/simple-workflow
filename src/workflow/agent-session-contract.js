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

export function normalizeAgentProcessStatus({ exitCode, error } = {}) {
  return !error && exitCode === 0 ? "succeeded" : "failed";
}
