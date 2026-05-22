const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const CANDIDATE_DECISIONS = new Set(["selected", "deferred"]);

export function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

export function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function requireStringArray(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${name} must be a string array`);
  }
  return value;
}

function normalizeCandidateComparison(value, name = "candidateComparison") {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }

  return value.map((item, index) => {
    const comparison = requireObject(item, `${name}.${index}`);
    const decision = requireString(comparison.decision, `${name}.${index}.decision`);
    if (!CANDIDATE_DECISIONS.has(decision)) {
      throw new Error(`${name}.${index}.decision must be selected or deferred`);
    }
    return {
      packageId: requireString(comparison.packageId, `${name}.${index}.packageId`),
      decision,
      reason: requireString(comparison.reason, `${name}.${index}.reason`),
    };
  });
}

function normalizeExecutionBrief(value, name = "executionBrief") {
  const brief = requireObject(value, name);
  return {
    goalInterpretation: requireString(
      brief.goalInterpretation,
      `${name}.goalInterpretation`,
    ),
    expectedOutcome: requireStringArray(brief.expectedOutcome, `${name}.expectedOutcome`),
    implementationHints: requireStringArray(
      brief.implementationHints,
      `${name}.implementationHints`,
    ),
    riskSignals: requireStringArray(brief.riskSignals, `${name}.riskSignals`),
    openQuestions: requireStringArray(brief.openQuestions, `${name}.openQuestions`),
  };
}

function validateCandidateComparison(recommendedPackageId, candidateComparison) {
  const selected = candidateComparison.filter((item) => item.decision === "selected");
  if (selected.length !== 1) {
    throw new Error("candidateComparison must contain exactly one selected item");
  }
  if (selected[0].packageId !== recommendedPackageId) {
    throw new Error("candidateComparison selected packageId must match recommendedPackageId");
  }
}

export function normalizeExecutionIntentArtifact(artifact, name = "executionIntent") {
  const intent = requireObject(artifact, name);
  const recommendedPackageId = requireString(
    intent.recommendedPackageId,
    `${name}.recommendedPackageId`,
  );
  const confidence = requireString(intent.confidence, `${name}.confidence`);
  if (!CONFIDENCE_LEVELS.has(confidence)) {
    throw new Error(`${name}.confidence must be high, medium, or low`);
  }

  const selectionReasoning = requireStringArray(
    intent.selectionReasoning,
    `${name}.selectionReasoning`,
  );
  const candidateComparison = normalizeCandidateComparison(
    intent.candidateComparison,
    `${name}.candidateComparison`,
  );
  validateCandidateComparison(recommendedPackageId, candidateComparison);

  return {
    recommendedPackageId,
    confidence,
    selectionReasoning,
    candidateComparison,
    executionBrief: normalizeExecutionBrief(
      intent.executionBrief,
      `${name}.executionBrief`,
    ),
  };
}
