import { spawn } from "node:child_process";

export const OPENCODE_RECOMMENDATION_ARGS = ["run", "--format", "json"];

export function toProgressEntry(event) {
  const type = event?.type ?? "event";
  if (type === "step_start") {
    return { type, message: "开始运行 opencode" };
  }
  if (type === "text") {
    return { type, message: "收到模型输出" };
  }
  if (type === "step_finish") {
    return { type, message: `运行结束：${event?.part?.reason ?? "unknown"}` };
  }
  return { type, message: `opencode 事件：${type}` };
}

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

function readJsonEventLines(buffer, onEvent) {
  const lines = buffer.split(/\r?\n/);
  const rest = lines.pop() ?? "";

  for (const line of lines) {
    if (line.trim().length === 0) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    onEvent?.(toProgressEntry(event), event);
  }

  return rest;
}

export function runOpencodeRecommendation({
  prompt,
  command = "opencode",
  args = OPENCODE_RECOMMENDATION_ARGS,
  cwd = process.cwd(),
  env = process.env,
  onProgress,
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
    let stdoutBuffer = "";
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
      stdoutBuffer = readJsonEventLines(stdoutBuffer + chunk, onProgress);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (stdoutBuffer) {
        stdoutBuffer = readJsonEventLines(`${stdoutBuffer}\n`, onProgress);
      }
      finish({
        stdout: extractTextFromJsonEvents(stdout),
        stderr,
        exitCode: null,
        error: error.message,
      });
    });

    child.on("close", (exitCode) => {
      if (stdoutBuffer) {
        stdoutBuffer = readJsonEventLines(`${stdoutBuffer}\n`, onProgress);
      }
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
