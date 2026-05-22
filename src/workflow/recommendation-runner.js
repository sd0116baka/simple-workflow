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
  signal,
} = {}) {
  let stdoutBuffer = "";
  return runAgentProcess({
    command,
    args,
    cwd,
    env,
    prompt,
    signal,
    onProgress,
    onStdoutChunk: (chunk) => {
      stdoutBuffer = readJsonEventLines(stdoutBuffer + chunk, onProgress);
    },
    beforeFinish: () => {
      if (stdoutBuffer) {
        stdoutBuffer = readJsonEventLines(`${stdoutBuffer}\n`, onProgress);
      }
    },
  }).then((result) => {
    return {
      stdout: extractTextFromJsonEvents(result.stdout),
      stderr: result.stderr,
      exitCode: result.exitCode,
      error: result.error,
    };
  });
}
