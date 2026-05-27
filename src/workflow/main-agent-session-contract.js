import { extractAgentJsonOutputText } from "./agent-json-output.js";
import {
  projectProfilePromptPath,
  readAgentPromptTemplate,
  renderAgentPromptTemplate,
} from "./agent-prompt-template.js";
import { inputArtifactRefsForConvergence } from "./agent-input-refs.js";
import {
  MAIN_AGENT_INITIALIZATION_INPUT_REFS,
  MAIN_AGENT_INITIALIZATION_RUN_ID,
} from "./main-agent-contract.js";
import { artifactBody, latestArtifactBody, latestArtifactRecord } from "./task-package-artifacts.js";

export const MAIN_AGENT_PROMPT_PATH = projectProfilePromptPath("main-agent.prompt.md");

function normalizeFindings(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeConvergenceDecision(value) {
  return ["success", "advice", "failure"].includes(value) ? value : null;
}

export function parseMainAgentOutputText(text) {
  try {
    const parsed = JSON.parse(extractAgentJsonOutputText(text));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const convergenceDecision = normalizeConvergenceDecision(parsed.convergenceDecision);
    return {
      ...parsed,
      findings: normalizeFindings(parsed.findings),
      ...(Object.hasOwn(parsed, "convergenceDecision") ? { convergenceDecision } : {}),
    };
  } catch {
    return {};
  }
}

function buildInitializationPayload({ taskContextPackage, runId, inputArtifactRefs }) {
  return {
    phase: "initialization",
    packageId: taskContextPackage.packageId,
    runId,
    inputArtifactRefs,
    taskDraft: taskContextPackage.taskDraft,
    executionIntent: artifactBody(taskContextPackage, "executionIntent"),
    executionAuthorization: artifactBody(taskContextPackage, "executionAuthorization"),
    isolatedWorkspace: artifactBody(taskContextPackage, "isolatedWorkspace"),
  };
}

function buildConvergencePayload({ taskContextPackage, runId, inputArtifactRefs }) {
  return {
    phase: "convergence",
    packageId: taskContextPackage.packageId,
    runId,
    inputArtifactRefs,
    taskDraft: taskContextPackage.taskDraft,
    executionIntent: artifactBody(taskContextPackage, "executionIntent"),
    executionAuthorization: artifactBody(taskContextPackage, "executionAuthorization"),
    isolatedWorkspace: artifactBody(taskContextPackage, "isolatedWorkspace"),
    executionReport: latestArtifactBody(taskContextPackage, "executionReport"),
    reviewReport: latestArtifactBody(taskContextPackage, "reviewReport"),
    convergenceAdvice: latestArtifactBody(taskContextPackage, "convergenceAdvice"),
    convergenceFailure: latestArtifactBody(taskContextPackage, "convergenceFailure"),
    humanConvergenceGuidance: latestArtifactBody(taskContextPackage, "humanConvergenceGuidance"),
  };
}

export function buildMainAgentPrompt({
  taskContextPackage,
  runId,
  sessionId = null,
  inputArtifactRefs = runId === MAIN_AGENT_INITIALIZATION_RUN_ID
    ? MAIN_AGENT_INITIALIZATION_INPUT_REFS
    : inputArtifactRefsForConvergence(
        taskContextPackage,
        latestArtifactRecord(taskContextPackage, "executionReport"),
        latestArtifactRecord(taskContextPackage, "reviewReport"),
      ),
  promptTemplate = readAgentPromptTemplate(MAIN_AGENT_PROMPT_PATH),
} = {}) {
  const isInitialization = runId === MAIN_AGENT_INITIALIZATION_RUN_ID;
  const payload = isInitialization
    ? buildInitializationPayload({ taskContextPackage, runId, inputArtifactRefs })
    : buildConvergencePayload({ taskContextPackage, runId, inputArtifactRefs });

  return renderAgentPromptTemplate(promptTemplate, JSON.stringify({ ...payload, sessionId }, null, 2));
}
