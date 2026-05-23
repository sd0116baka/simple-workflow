import {
  buildAgentProcessFailure,
  normalizeAgentProcessStatus,
} from "./agent-session-contract.js";
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

function cancelledMainSession({ role, packageId, runId, sessionId }) {
  const failure = buildAgentProcessFailure({ role, cancelled: true });
  return {
    role,
    packageId,
    sessionId: sessionId ?? `opencode-session-cancelled:${runId}`,
    status: "cancelled",
    failure,
    summary: "main agent 已取消。",
    nextAction: "",
    findings: [],
    rawOutput: {
      stdout: "",
      stderr: "",
      exitCode: null,
      error: "cancelled",
      failure,
    },
  };
}

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
    return Promise.resolve(cancelledMainSession({ role, packageId, runId, sessionId }));
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
    const failure = buildAgentProcessFailure({
      role,
      exitCode: result.exitCode,
      error: result.error,
      cancelled: result.cancelled,
      stderr: result.stderr,
    });
    const status = normalizeAgentProcessStatus({ failure });
    const nextSessionId = findSessionIdInJsonEvents(result.stdout)
      ?? sessionId
      ?? `opencode-session-unavailable:${runId}`;

    return {
      role,
      packageId,
      sessionId: nextSessionId,
      status,
      ...(failure ? { failure } : {}),
      summary: typeof report.summary === "string" && report.summary.trim().length > 0
        ? report.summary
        : extractedText.trim() || failure?.message,
      nextAction: typeof report.nextAction === "string" ? report.nextAction : "",
      findings: Array.isArray(report.findings) ? report.findings : [],
      rawOutput: {
        stdout: extractedText,
        stderr: result.stderr,
        exitCode: result.exitCode,
        error: result.error,
        failure,
      },
    };
  });
}
