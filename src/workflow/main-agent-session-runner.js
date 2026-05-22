import { normalizeAgentProcessStatus } from "./agent-session-contract.js";
import { createAgentProcessProgressEntries } from "./agent-process-progress.js";
import { runAgentProcess } from "./agent-process-runner.js";
import {
  buildMainAgentPrompt,
  parseMainAgentOutputText,
} from "./main-agent-session-contract.js";
import {
  extractTextFromJsonEvents,
  findSessionIdInJsonEvents,
} from "./opencode-json-events.js";

export const OPENCODE_MAIN_ARGS = ["run", "--format", "json"];

export function runOpencodeMainAgentSession({
  role,
  packageId,
  cwd = process.cwd(),
  runId,
  sessionId = null,
  taskContextPackage,
  inputArtifactRefs,
  command = "opencode",
  args = OPENCODE_MAIN_ARGS,
  env = process.env,
  shell = process.platform === "win32",
  onProgress,
  signal,
}) {
  const prompt = buildMainAgentPrompt({
    taskContextPackage,
    runId,
    sessionId,
    inputArtifactRefs,
  });
  if (signal?.aborted) {
    return Promise.resolve({
      role,
      packageId,
      sessionId: sessionId ?? `opencode-session-cancelled:${runId}`,
      status: "cancelled",
      summary: "main agent 已取消。",
      nextAction: "",
      findings: [],
      rawOutput: {
        stdout: "",
        stderr: "",
        exitCode: null,
        error: "cancelled",
      },
    });
  }

  return runAgentProcess({
    command,
    args,
    cwd,
    env,
    shell,
    prompt,
    signal,
    onProgress,
    progressEntries: createAgentProcessProgressEntries({
      typePrefix: "main_",
      systemStream: "main-agent",
      stdoutStream: "main-stdout",
      stderrStream: "main-stderr",
      subject: runId,
    }),
  }).then((result) => {
    const extractedText = extractTextFromJsonEvents(result.stdout);
    const report = parseMainAgentOutputText(extractedText);
    const status = result.cancelled
      ? "cancelled"
      : normalizeAgentProcessStatus({ exitCode: result.exitCode, error: result.error });
    const nextSessionId = findSessionIdInJsonEvents(result.stdout)
      ?? sessionId
      ?? `opencode-session-unavailable:${runId}`;

    return {
      role,
      packageId,
      sessionId: nextSessionId,
      status,
      summary: typeof report.summary === "string" && report.summary.trim().length > 0
        ? report.summary
        : extractedText.trim(),
      nextAction: typeof report.nextAction === "string" ? report.nextAction : "",
      findings: Array.isArray(report.findings) ? report.findings : [],
      rawOutput: {
        stdout: extractedText,
        stderr: result.stderr,
        exitCode: result.exitCode,
        error: result.error,
      },
    };
  });
}
