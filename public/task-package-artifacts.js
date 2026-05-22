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

export function artifactRecordsFromValue(artifactValue) {
  if (Array.isArray(artifactValue)) return artifactValue;
  return artifactValue ? [artifactValue] : [];
}

export function allArtifactRecords(taskContextPackage) {
  return Object.entries(taskContextPackage?.artifacts ?? {}).flatMap(([artifactType, value]) =>
    artifactRecordsFromValue(value).map((artifact) => ({ artifactType, artifact })),
  );
}

export function artifactById(taskContextPackage, artifactId) {
  return allArtifactRecords(taskContextPackage).find((item) => item.artifact?.artifactId === artifactId) ?? null;
}

export function multiArtifactRecords(taskContextPackage, artifactType) {
  const artifacts = taskContextPackage?.artifacts?.[artifactType];
  return Array.isArray(artifacts) ? artifacts : [];
}

export function latestArtifactRecord(taskContextPackage, artifactType) {
  const records = multiArtifactRecords(taskContextPackage, artifactType);
  return records.length > 0
    ? records[records.length - 1]
    : null;
}
