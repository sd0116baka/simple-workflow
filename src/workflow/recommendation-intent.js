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

function normalizeCandidateComparison(value) {
  if (!Array.isArray(value)) {
    throw new Error("candidateComparison must be an array");
  }

  return value.map((item, index) => {
    const comparison = requireObject(item, `candidateComparison.${index}`);
    const decision = requireString(comparison.decision, `candidateComparison.${index}.decision`);
    if (!CANDIDATE_DECISIONS.has(decision)) {
      throw new Error(`candidateComparison.${index}.decision must be selected or deferred`);
    }
    return {
      packageId: requireString(comparison.packageId, `candidateComparison.${index}.packageId`),
      decision,
      reason: requireString(comparison.reason, `candidateComparison.${index}.reason`),
    };
  });
}

function normalizeExecutionBrief(value) {
  const brief = requireObject(value, "executionBrief");
  return {
    goalInterpretation: requireString(
      brief.goalInterpretation,
      "executionBrief.goalInterpretation",
    ),
    expectedOutcome: requireStringArray(brief.expectedOutcome, "executionBrief.expectedOutcome"),
    implementationHints: requireStringArray(
      brief.implementationHints,
      "executionBrief.implementationHints",
    ),
    riskSignals: requireStringArray(brief.riskSignals, "executionBrief.riskSignals"),
    openQuestions: requireStringArray(brief.openQuestions, "executionBrief.openQuestions"),
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
    const recommendedPackageId = requireString(
      payload.recommendedPackageId,
      "recommendedPackageId",
    );
    if (!CONFIDENCE_LEVELS.has(payload.confidence)) {
      throw new Error("confidence must be high, medium, or low");
    }

    const selectionReasoning = requireStringArray(
      payload.selectionReasoning,
      "selectionReasoning",
    );
    const candidateComparison = normalizeCandidateComparison(payload.candidateComparison);
    validateCandidateComparison(recommendedPackageId, candidateComparison);

    return {
      intent: {
        recommendedPackageId,
        confidence: payload.confidence,
        selectionReasoning,
        candidateComparison,
        executionBrief: normalizeExecutionBrief(payload.executionBrief),
      },
      error: null,
    };
  } catch (error) {
    return {
      intent: null,
      error: error.message,
    };
  }
}
