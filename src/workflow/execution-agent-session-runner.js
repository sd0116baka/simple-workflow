import { normalizeAgentProcessStatus } from "./agent-session-contract.js";
import { createAgentProcessProgressEntries } from "./agent-process-progress.js";
import { runAgentProcess } from "./agent-process-runner.js";
import {
  buildExecutionAgentPrompt,
  parseExecutionAgentReportText,
} from "./execution-agent-session-contract.js";
import {
  extractTextFromJsonEvents,
  findSessionIdInJsonEvents,
} from "./opencode-json-events.js";

export const OPENCODE_EXECUTION_ARGS = ["run", "--format", "json"];

export function runOpencodeExecutionAgentSession({
  role,
  packageId,
  cwd,
  runId,
  taskContextPackage,
  inputArtifactRefs,
  command = "opencode",
  args = OPENCODE_EXECUTION_ARGS,
  env = process.env,
  shell = process.platform === "win32",
  onProgress,
  signal,
}) {
  const prompt = buildExecutionAgentPrompt({
    taskContextPackage,
    runId,
    inputArtifactRefs,
  });
  if (signal?.aborted) {
    return Promise.resolve({
      role,
      packageId,
      sessionId: `opencode-session-cancelled:${runId}`,
      status: "cancelled",
      summary: "execution agent 已取消。",
      tests: [],
      notes: [],
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
      typePrefix: "execution_",
      systemStream: "execution-agent",
      stdoutStream: "execution-stdout",
      stderrStream: "execution-stderr",
      subject: runId,
    }),
  }).then((result) => {
    const extractedText = extractTextFromJsonEvents(result.stdout);
    const report = parseExecutionAgentReportText(extractedText);
    const status = result.cancelled
      ? "cancelled"
      : normalizeAgentProcessStatus({ exitCode: result.exitCode, error: result.error });
    const sessionId = findSessionIdInJsonEvents(result.stdout) ?? `opencode-session-unavailable:${runId}`;

    return {
      role,
      packageId,
      sessionId,
      status,
      summary: typeof report.summary === "string" && report.summary.trim().length > 0
        ? report.summary
        : extractedText.trim(),
      tests: Array.isArray(report.tests) ? report.tests : [],
      notes: Array.isArray(report.notes) ? report.notes : [],
      rawOutput: {
        stdout: extractedText,
        stderr: result.stderr,
        exitCode: result.exitCode,
        error: result.error,
      },
    };
  });
}
