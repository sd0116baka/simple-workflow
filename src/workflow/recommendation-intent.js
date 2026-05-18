const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const CANDIDATE_DECISIONS = new Set(["selected", "deferred"]);

function extractJsonText(output) {
  const text = String(output ?? "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced ? fenced[1].trim() : text;
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function requireString(value, name) {
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

export function parseRecommendationIntent(output) {
  try {
    const payload = requireObject(JSON.parse(extractJsonText(output)), "recommendation intent");
    const appendRequest = requireObject(payload.appendRequest, "appendRequest");
    const packageId = requireString(appendRequest.packageId, "appendRequest.packageId");
    const artifactType = requireString(appendRequest.artifactType, "appendRequest.artifactType");
    if (artifactType !== "executionIntent") {
      throw new Error("appendRequest.artifactType must be executionIntent");
    }
    const artifact = requireObject(appendRequest.artifact, "appendRequest.artifact");
    const recommendedPackageId = requireString(
      artifact.recommendedPackageId,
      "appendRequest.artifact.recommendedPackageId",
    );
    if (recommendedPackageId !== packageId) {
      throw new Error("appendRequest.artifact.recommendedPackageId must match appendRequest.packageId");
    }
    if (!CONFIDENCE_LEVELS.has(artifact.confidence)) {
      throw new Error("confidence must be high, medium, or low");
    }

    const selectionReasoning = requireStringArray(
      artifact.selectionReasoning,
      "appendRequest.artifact.selectionReasoning",
    );
    const candidateComparison = normalizeCandidateComparison(
      artifact.candidateComparison,
      "appendRequest.artifact.candidateComparison",
    );
    validateCandidateComparison(recommendedPackageId, candidateComparison);

    const normalizedArtifact = {
      recommendedPackageId,
      confidence: artifact.confidence,
      selectionReasoning,
      candidateComparison,
      executionBrief: normalizeExecutionBrief(
        artifact.executionBrief,
        "appendRequest.artifact.executionBrief",
      ),
    };

    return {
      appendRequest: {
        packageId,
        artifactType,
        artifact: normalizedArtifact,
      },
      intent: normalizedArtifact,
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
