export function createStubAgentSession({ role, packageId }) {
  return {
    sessionId: `stub-${role}-session:${packageId}`,
    status: "succeeded",
  };
}
