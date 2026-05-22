function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  const text = String(value ?? "").trim();
  return text ? [text] : [];
}

export function buildHumanConvergenceGuidanceRequest({
  taskContextPackage,
  decisionTarget,
  guidance,
  focusAreas = [],
  avoidRepeating = [],
  expectedNextOutcome = "",
  decidedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "humanConvergenceGuidance",
    artifact: {
      decision: "continue-convergence-with-guidance",
      targetType: decisionTarget.kind,
      targetRef: decisionTarget.artifact.artifactId,
      decidedAt,
      guidance: String(guidance ?? "").trim(),
      focusAreas: normalizeList(focusAreas),
      avoidRepeating: normalizeList(avoidRepeating),
      expectedNextOutcome: String(expectedNextOutcome ?? "").trim(),
      nextRequiredStage: "convergence",
    },
  };
}

export function buildAcceptConvergenceDecisionRequest({
  taskContextPackage,
  convergenceSuccess,
  isolatedWorkspace,
  worktreeSnapshot,
  decidedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "humanDecision",
    artifact: {
      decision: "accept-convergence",
      decidedAt,
      convergenceSuccessRef: convergenceSuccess.artifactId,
      acceptedWork: {
        isolatedWorkspaceRef: isolatedWorkspace.artifactId,
        worktreePath: isolatedWorkspace.body.worktreePath,
        branchName: isolatedWorkspace.body.branchName,
        baseCommit: isolatedWorkspace.body.baseCommit,
      },
      worktreeSnapshot,
      nextRequiredStage: "auto-merge-planning",
    },
  };
}

export function buildCancelTaskDecisionRequest({
  taskContextPackage,
  decisionTarget,
  decidedAt,
}) {
  return {
    packageId: taskContextPackage.packageId,
    artifactType: "humanDecision",
    artifact: {
      decision: "cancel-task",
      decidedAt,
      targetType: decisionTarget.kind,
      targetRef: decisionTarget.artifact.artifactId,
      nextRequiredStage: "task-closeout",
    },
  };
}
