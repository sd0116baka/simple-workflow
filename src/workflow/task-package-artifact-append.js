import { cloneJsonValue } from "./json-value.js";

const MULTI_ARTIFACT_TYPES = new Set([
  "executionReport",
  "reviewReport",
  "convergenceAdvice",
  "convergenceFailure",
  "humanConvergenceGuidance",
]);

function artifactRecord({ artifactId, artifact, appendedAt }) {
  return {
    artifactId,
    body: cloneJsonValue(artifact),
    appendedAt,
  };
}

function nextMultiArtifactId(artifacts, artifactType) {
  const existing = Array.isArray(artifacts?.[artifactType])
    ? artifacts[artifactType]
    : [];
  return `${artifactType}:${String(existing.length + 1).padStart(3, "0")}`;
}

export function appendArtifact(artifacts, appendRequest, appendedAt) {
  if (!appendRequest.artifactType) return { artifacts, artifactId: null };

  const artifactType = appendRequest.artifactType;
  const artifactId = MULTI_ARTIFACT_TYPES.has(artifactType)
    ? nextMultiArtifactId(artifacts, artifactType)
    : artifactType;
  const record = artifactRecord({
    artifactId,
    artifact: appendRequest.artifact,
    appendedAt,
  });

  if (MULTI_ARTIFACT_TYPES.has(artifactType)) {
    return {
      artifactId,
      artifacts: {
        ...artifacts,
        [artifactType]: [
          ...(Array.isArray(artifacts?.[artifactType]) ? artifacts[artifactType] : []),
          record,
        ],
      },
    };
  }

  return {
    artifactId,
    artifacts: {
      ...artifacts,
      [artifactType]: record,
    },
  };
}
