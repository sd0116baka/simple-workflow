import { multiArtifactRecords } from "./task-package-artifacts.js";

function convergenceAdviceRecords(taskContextPackage) {
  return multiArtifactRecords(taskContextPackage, "convergenceAdvice");
}

function failureInputFromAdvice(taskContextPackage, maxIterations) {
  const convergenceAdvice = convergenceAdviceRecords(taskContextPackage);
  return {
    attemptedFixRefs: convergenceAdvice.map((advice) => advice.artifactId),
    completedIterations: Math.max(convergenceAdvice.length, 1),
    maxIterations,
  };
}

export function convergenceOutcome({ taskContextPackage, session, maxIterations = null }) {
  if (session?.convergenceDecision === "success") {
    return { kind: "success" };
  }

  const requestedFailure = session?.convergenceDecision === "failure";
  if (
    requestedFailure
      || (
        Number.isInteger(maxIterations)
        && convergenceAdviceRecords(taskContextPackage).length >= maxIterations
      )
  ) {
    return {
      kind: "failure",
      failureInput: failureInputFromAdvice(taskContextPackage, maxIterations),
    };
  }

  return { kind: "advice" };
}
