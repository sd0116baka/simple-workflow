import { spawn } from "node:child_process";

export const OPENCODE_RECOMMENDATION_ARGS = ["run", "--format", "json"];

export function extractTextFromJsonEvents(output) {
  const lines = String(output ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const textParts = [];

  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return output;
    }
    if (event?.type === "text" && typeof event.part?.text === "string") {
      textParts.push(event.part.text);
    }
  }

  return textParts.length > 0 ? textParts.join("\n") : output;
}

export function runOpencodeRecommendation({
  prompt,
  command = "opencode",
  args = OPENCODE_RECOMMENDATION_ARGS,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: process.platform === "win32",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    function finish(result) {
      if (settled) return;
      settled = true;
      resolve(result);
    }

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      finish({
        stdout: extractTextFromJsonEvents(stdout),
        stderr,
        exitCode: null,
        error: error.message,
      });
    });

    child.on("close", (exitCode) => {
      finish({
        stdout: extractTextFromJsonEvents(stdout),
        stderr,
        exitCode,
        error: null,
      });
    });

    if (prompt) {
      child.stdin?.write(prompt);
    }
    child.stdin?.end();
  });
}
