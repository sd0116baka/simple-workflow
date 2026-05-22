import { extractAgentJsonOutputText } from "./agent-json-output.js";
import {
  normalizeExecutionIntentArtifact,
  requireObject,
  requireString,
} from "./execution-intent-artifact.js";

export { normalizeExecutionIntentArtifact } from "./execution-intent-artifact.js";

export function buildExecutionIntentRequest({
  packageId,
  confidence,
  selectionReasoning,
  candidateComparison,
  executionBrief,
}) {
  const artifact = normalizeExecutionIntentArtifact({
    recommendedPackageId: packageId,
    confidence,
    selectionReasoning,
    candidateComparison,
    executionBrief,
  });

  return {
    packageId,
    artifactType: "executionIntent",
    artifact,
  };
}

export function parseRecommendationIntent(output) {
  try {
    const payload = requireObject(
      JSON.parse(extractAgentJsonOutputText(output, { allowEmbeddedFence: true })),
      "recommendation intent",
    );
    const appendRequest = requireObject(payload.appendRequest, "appendRequest");
    const packageId = requireString(appendRequest.packageId, "appendRequest.packageId");
    const artifactType = requireString(appendRequest.artifactType, "appendRequest.artifactType");
    if (artifactType !== "executionIntent") {
      throw new Error("appendRequest.artifactType must be executionIntent");
    }
    const artifact = normalizeExecutionIntentArtifact(
      appendRequest.artifact,
      "appendRequest.artifact",
    );
    if (artifact.recommendedPackageId !== packageId) {
      throw new Error("appendRequest.artifact.recommendedPackageId must match appendRequest.packageId");
    }

    return {
      appendRequest: {
        packageId,
        artifactType,
        artifact,
      },
      intent: artifact,
      error: null,
    };
  } catch (error) {
    return {
      appendRequest: null,
      intent: null,
      error: error.message,
    };
  }
}
