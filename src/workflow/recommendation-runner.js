import { runAgentProcess } from "./agent-process-runner.js";
import {
  extractTextFromJsonEvents,
  readJsonEventLines,
} from "./opencode-json-events.js";

export const OPENCODE_RECOMMENDATION_ARGS = ["run", "--format", "json"];

export function runOpencodeRecommendation({
  prompt,
  command = "opencode",
  args = OPENCODE_RECOMMENDATION_ARGS,
  cwd = process.cwd(),
  env = process.env,
  onProgress,
  onTerminalSession,
  signal,
  terminalSessionService = null,
} = {}) {
  let stdoutBuffer = "";
  const processStdoutChunk = (chunk) => {
    stdoutBuffer = readJsonEventLines(stdoutBuffer + chunk, onProgress);
  };
  const flushStdoutBuffer = () => {
    if (stdoutBuffer) {
      stdoutBuffer = readJsonEventLines(`${stdoutBuffer}\n`, onProgress);
    }
  };

  if (terminalSessionService) {
    return terminalSessionService.runTerminalCommand({
      command,
      args,
      cwd,
      env,
      prompt,
      signal,
      title: "任务推荐器",
      onStarted: onTerminalSession,
      onStdoutChunk: processStdoutChunk,
      onFinish: flushStdoutBuffer,
    }).then((result) => ({
      stdout: extractTextFromJsonEvents(result.stdout),
      stderr: result.stderr,
      exitCode: result.exitCode,
      error: result.error,
      terminalSessionId: result.terminalSession?.id ?? null,
    }));
  }

  return runAgentProcess({
    command,
    args,
    cwd,
    env,
    prompt,
    signal,
    onProgress,
    onStdoutChunk: processStdoutChunk,
    beforeFinish: flushStdoutBuffer,
  }).then((result) => {
    return {
      stdout: extractTextFromJsonEvents(result.stdout),
      stderr: result.stderr,
      exitCode: result.exitCode,
      error: result.error,
    };
  });
}
