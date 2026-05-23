import {
  buildAgentProcessFailure,
  normalizeAgentProcessStatus,
} from "./agent-session-contract.js";
import { createAgentProcessProgressEntries } from "./agent-process-progress.js";
import { runAgentProcess } from "./agent-process-runner.js";
import {
  buildReviewAgentPrompt,
  parseReviewAgentReportText,
} from "./review-agent-session-contract.js";
import {
  extractTextFromJsonEvents,
  findSessionIdInJsonEvents,
} from "./opencode-json-events.js";

export const OPENCODE_REVIEW_ARGS = ["run", "--format", "json"];

function cancelledReviewSession({ role, packageId, runId }) {
  const failure = buildAgentProcessFailure({ role, cancelled: true });
  return {
    role,
    packageId,
    sessionId: `opencode-session-cancelled:${runId}`,
    status: "cancelled",
    failure,
    outcome: "failed",
    summary: "review agent 已取消。",
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

export function runOpencodeReviewAgentSession({
  role,
  packageId,
  cwd,
  runId,
  taskContextPackage,
  inputArtifactRefs,
  command = "opencode",
  args = OPENCODE_REVIEW_ARGS,
  env = process.env,
  shell = process.platform === "win32",
  onProgress,
  signal,
}) {
  const prompt = buildReviewAgentPrompt({
    taskContextPackage,
    runId,
    inputArtifactRefs,
  });
  if (signal?.aborted) {
    return Promise.resolve(cancelledReviewSession({ role, packageId, runId }));
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
      typePrefix: "review_",
      systemStream: "review-agent",
      stdoutStream: "review-stdout",
      stderrStream: "review-stderr",
      subject: runId,
    }),
  }).then((result) => {
    const extractedText = extractTextFromJsonEvents(result.stdout);
    const report = parseReviewAgentReportText(extractedText);
    const failure = buildAgentProcessFailure({
      role,
      exitCode: result.exitCode,
      error: result.error,
      cancelled: result.cancelled,
      stderr: result.stderr,
    });
    const status = normalizeAgentProcessStatus({ failure });
    const sessionId = findSessionIdInJsonEvents(result.stdout) ?? `opencode-session-unavailable:${runId}`;

    return {
      role,
      packageId,
      sessionId,
      status,
      ...(failure ? { failure } : {}),
      outcome: report.outcome ?? "failed",
      summary: typeof report.summary === "string" && report.summary.trim().length > 0
        ? report.summary
        : extractedText.trim() || failure?.message,
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
