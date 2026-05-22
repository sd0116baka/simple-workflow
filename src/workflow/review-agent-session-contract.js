import { extractAgentJsonOutputText } from "./agent-json-output.js";
import {
  projectProfilePromptPath,
  readAgentPromptTemplate,
  renderAgentPromptTemplate,
} from "./agent-prompt-template.js";
import { inputArtifactRefsForReview } from "./agent-input-refs.js";
import { artifactBody, latestArtifactBody, latestArtifactRecord } from "./task-package-artifacts.js";

export const REVIEW_AGENT_PROMPT_PATH = projectProfilePromptPath("review-agent.prompt.md");

function normalizeOutcome(value) {
  return value === "failed" ? "failed" : "passed";
}

function normalizeFindings(value) {
  return Array.isArray(value) ? value : [];
}

export function parseReviewAgentReportText(text) {
  try {
    const parsed = JSON.parse(extractAgentJsonOutputText(text));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return {
      ...parsed,
      outcome: normalizeOutcome(parsed.outcome),
      findings: normalizeFindings(parsed.findings),
    };
  } catch {
    return {};
  }
}

export function buildReviewAgentPrompt({
  taskContextPackage,
  runId,
  inputArtifactRefs = inputArtifactRefsForReview(
    taskContextPackage,
    latestArtifactRecord(taskContextPackage, "executionReport"),
  ),
  promptTemplate = readAgentPromptTemplate(REVIEW_AGENT_PROMPT_PATH),
} = {}) {
  const payload = {
    packageId: taskContextPackage.packageId,
    runId,
    inputArtifactRefs,
    taskDraft: taskContextPackage.taskDraft,
    executionAuthorization: artifactBody(taskContextPackage, "executionAuthorization"),
    isolatedWorkspace: artifactBody(taskContextPackage, "isolatedWorkspace"),
    executionReport: latestArtifactBody(taskContextPackage, "executionReport"),
    convergenceAdvice: latestArtifactBody(taskContextPackage, "convergenceAdvice"),
    humanConvergenceGuidance: latestArtifactBody(taskContextPackage, "humanConvergenceGuidance"),
  };

  return renderAgentPromptTemplate(promptTemplate, JSON.stringify(payload, null, 2));
}
