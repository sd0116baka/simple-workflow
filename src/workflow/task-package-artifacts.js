export function artifactRecord(taskContextPackage, artifactType) {
  const artifact = taskContextPackage?.artifacts?.[artifactType];
  return artifact && !Array.isArray(artifact) ? artifact : null;
}

export function artifactBody(taskContextPackage, artifactType) {
  return artifactRecord(taskContextPackage, artifactType)?.body ?? null;
}

export function hasArtifactBody(taskContextPackage, artifactType) {
  return Boolean(artifactBody(taskContextPackage, artifactType));
}

export function multiArtifactRecords(taskContextPackage, artifactType) {
  const artifacts = taskContextPackage?.artifacts?.[artifactType];
  return Array.isArray(artifacts) ? artifacts : [];
}

export function multiArtifactRecordCount(taskContextPackage, artifactType) {
  return multiArtifactRecords(taskContextPackage, artifactType).length;
}

export function latestArtifactRecord(taskContextPackage, artifactType) {
  const records = multiArtifactRecords(taskContextPackage, artifactType);
  return records.length > 0
    ? records[records.length - 1]
    : null;
}

export function latestArtifactBody(taskContextPackage, artifactType) {
  return latestArtifactRecord(taskContextPackage, artifactType)?.body ?? null;
}
