import { artifactRecord, latestArtifactRecord } from "./task-package-artifacts.js";

export function latestConvergenceSuccess(taskContextPackage) {
  return artifactRecord(taskContextPackage, "convergenceSuccess");
}

export function latestConvergenceFailure(taskContextPackage) {
  return latestArtifactRecord(taskContextPackage, "convergenceFailure");
}

export function humanDecisionArtifactByType(taskContextPackage, artifactType) {
  if (artifactType === "convergenceFailure" || artifactType === "humanConvergenceGuidance") {
    return latestArtifactRecord(taskContextPackage, artifactType);
  }
  return artifactRecord(taskContextPackage, artifactType);
}

export function latestHumanDecisionTarget(taskContextPackage) {
  const humanDecisionRequest = artifactRecord(taskContextPackage, "humanDecisionRequest");
  const requestedTargetType = humanDecisionRequest?.body?.targetType;
  const requestedTargetRef = humanDecisionRequest?.body?.targetRef;
  if (requestedTargetType && requestedTargetRef) {
    const targetArtifact = humanDecisionArtifactByType(taskContextPackage, requestedTargetType);
    if (targetArtifact?.artifactId === requestedTargetRef) {
      return {
        kind: requestedTargetType,
        artifact: targetArtifact,
        requestRefField: "targetRef",
      };
    }
  }

  const requestedSuccessRef = humanDecisionRequest?.body?.convergenceSuccessRef;
  if (requestedSuccessRef) {
    const convergenceSuccess = latestConvergenceSuccess(taskContextPackage);
    if (convergenceSuccess?.artifactId === requestedSuccessRef) {
      return {
        kind: "convergenceSuccess",
        artifact: convergenceSuccess,
        requestRefField: "convergenceSuccessRef",
      };
    }
  }

  const requestedFailureRef = humanDecisionRequest?.body?.targetRef;
  if (requestedFailureRef) {
    const convergenceFailure = latestConvergenceFailure(taskContextPackage);
    if (convergenceFailure?.artifactId === requestedFailureRef) {
      return {
        kind: "convergenceFailure",
        artifact: convergenceFailure,
        requestRefField: "targetRef",
      };
    }
  }

  const convergenceFailure = latestConvergenceFailure(taskContextPackage);
  if (convergenceFailure) {
    return {
      kind: "convergenceFailure",
      artifact: convergenceFailure,
      requestRefField: "targetRef",
    };
  }
  const convergenceSuccess = latestConvergenceSuccess(taskContextPackage);
  if (convergenceSuccess) {
    return {
      kind: "convergenceSuccess",
      artifact: convergenceSuccess,
      requestRefField: "convergenceSuccessRef",
    };
  }
  return null;
}

export function humanDecisionRequestMatchesTarget(humanDecisionRequest, target) {
  if (!humanDecisionRequest?.body || !target?.artifact) return false;
  if (target.kind === "convergenceSuccess") {
    return humanDecisionRequest.body.convergenceSuccessRef === target.artifact.artifactId;
  }
  if (humanDecisionRequest.body.targetType) {
    return humanDecisionRequest.body.targetType === target.kind
      && humanDecisionRequest.body.targetRef === target.artifact.artifactId;
  }
  return humanDecisionRequest.body[target.requestRefField] === target.artifact.artifactId;
}
