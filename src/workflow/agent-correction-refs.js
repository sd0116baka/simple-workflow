import { latestArtifactRecord } from "./task-package-artifacts.js";

function optionalArtifactRef(taskContextPackage, artifactType) {
  return latestArtifactRecord(taskContextPackage, artifactType)?.artifactId;
}

export function agentCorrectionInputRefs(taskContextPackage) {
  const automaticAdviceRefs = [
    optionalArtifactRef(taskContextPackage, "convergenceAdvice"),
  ].filter(Boolean);
  const humanCorrectionRefs = [
    optionalArtifactRef(taskContextPackage, "convergenceFailure"),
    optionalArtifactRef(taskContextPackage, "humanConvergenceGuidance"),
  ].filter(Boolean);

  return {
    automaticAdviceRefs,
    humanCorrectionRefs,
    allCorrectionRefs: [
      ...automaticAdviceRefs,
      ...humanCorrectionRefs,
    ],
  };
}
