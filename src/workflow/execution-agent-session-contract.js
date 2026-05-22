import { extractAgentJsonOutputText } from "./agent-json-output.js";
import {
  projectProfilePromptPath,
  readAgentPromptTemplate,
  renderAgentPromptTemplate,
} from "./agent-prompt-template.js";
import { artifactBody, latestArtifactBody } from "./task-package-artifacts.js";

export const EXECUTION_AGENT_PROMPT_PATH = projectProfilePromptPath("execution-agent.prompt.md");

export function parseExecutionAgentReportText(text) {
  try {
    const parsed = JSON.parse(extractAgentJsonOutputText(text));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function buildExecutionAgentPrompt({
  taskContextPackage,
  runId,
  inputArtifactRefs,
  promptTemplate = readAgentPromptTemplate(EXECUTION_AGENT_PROMPT_PATH),
} = {}) {
  const payload = {
    packageId: taskContextPackage.packageId,
    runId,
    inputArtifactRefs,
    taskDraft: taskContextPackage.taskDraft,
    executionIntent: artifactBody(taskContextPackage, "executionIntent"),
    executionAuthorization: artifactBody(taskContextPackage, "executionAuthorization"),
    isolatedWorkspace: artifactBody(taskContextPackage, "isolatedWorkspace"),
    convergenceAdvice: latestArtifactBody(taskContextPackage, "convergenceAdvice"),
    convergenceFailure: latestArtifactBody(taskContextPackage, "convergenceFailure"),
    humanConvergenceGuidance: latestArtifactBody(taskContextPackage, "humanConvergenceGuidance"),
  };

  return renderAgentPromptTemplate(promptTemplate, JSON.stringify(payload, null, 2));
}
