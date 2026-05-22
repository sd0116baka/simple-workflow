import { latestArtifactRecord, multiArtifactRecords } from "./task-package-artifacts.js";

function convergenceAdviceRecords(taskContextPackage) {
  return multiArtifactRecords(taskContextPackage, "convergenceAdvice");
}

function hasPriorConvergenceAdvice(taskContextPackage) {
  return Boolean(latestArtifactRecord(taskContextPackage, "convergenceAdvice"));
}

function failureInputFromAdvice(taskContextPackage, maxIterations) {
  const convergenceAdvice = convergenceAdviceRecords(taskContextPackage);
  return {
    attemptedFixRefs: convergenceAdvice.map((advice) => advice.artifactId),
    completedIterations: Math.max(convergenceAdvice.length, 1),
    maxIterations,
  };
}

export function convergenceOutcome({ taskContextPackage, reviewReport, maxIterations = null }) {
  if (reviewReport?.body?.outcome === "passed" && hasPriorConvergenceAdvice(taskContextPackage)) {
    return { kind: "success" };
  }

  if (
    Number.isInteger(maxIterations)
    && convergenceAdviceRecords(taskContextPackage).length >= maxIterations
  ) {
    return {
      kind: "failure",
      failureInput: failureInputFromAdvice(taskContextPackage, maxIterations),
    };
  }

  return { kind: "advice" };
}
