import { agentCorrectionInputRefs } from "./agent-correction-refs.js";

export const EXECUTION_AGENT_BASE_INPUT_REFS = [
  "taskDraft",
  "executionIntent",
  "executionAuthorization",
];

export function inputArtifactRefsForExecution(taskContextPackage) {
  const { allCorrectionRefs } = agentCorrectionInputRefs(taskContextPackage);

  return allCorrectionRefs.length > 0
    ? [...EXECUTION_AGENT_BASE_INPUT_REFS, ...allCorrectionRefs, "isolatedWorkspace"]
    : [...EXECUTION_AGENT_BASE_INPUT_REFS, "isolatedWorkspace"];
}

export function inputArtifactRefsForReview(taskContextPackage, executionReport) {
  const { allCorrectionRefs } = agentCorrectionInputRefs(taskContextPackage);

  return allCorrectionRefs.length > 0
    ? [
        "taskDraft",
        "executionAuthorization",
        ...allCorrectionRefs,
        "isolatedWorkspace",
        executionReport.artifactId,
      ]
    : [
        "taskDraft",
        "executionAuthorization",
        "isolatedWorkspace",
        executionReport.artifactId,
      ];
}

export function inputArtifactRefsForConvergence(taskContextPackage, executionReport, reviewReport) {
  const { automaticAdviceRefs, humanCorrectionRefs } = agentCorrectionInputRefs(taskContextPackage);
  const baseRefs = automaticAdviceRefs.length > 0
    ? [
        "taskDraft",
        "executionIntent",
        "executionAuthorization",
        ...automaticAdviceRefs,
        executionReport.artifactId,
        reviewReport.artifactId,
      ]
    : [
        "taskDraft",
        "executionIntent",
        "executionAuthorization",
        executionReport.artifactId,
        reviewReport.artifactId,
      ];

  return humanCorrectionRefs.length > 0
    ? [
        ...baseRefs.slice(0, -2),
        ...humanCorrectionRefs,
        ...baseRefs.slice(-2),
      ]
    : baseRefs;
}
