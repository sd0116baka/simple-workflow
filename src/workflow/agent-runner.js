export function createStubAgentSession({ role, packageId }) {
  return {
    sessionId: `stub-${role}-session:${packageId}`,
    status: "succeeded",
  };
}

export function normalizeAgentStatus({ exitCode, error } = {}) {
  return !error && exitCode === 0 ? "succeeded" : "failed";
}
