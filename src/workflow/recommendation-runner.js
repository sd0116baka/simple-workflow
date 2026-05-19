import { spawn } from "node:child_process";
import { terminateProcessTree } from "./process-control.js";

export const OPENCODE_RECOMMENDATION_ARGS = ["run", "--format", "json"];

function truncateTerminalLine(text, maxLength = 4000) {
  const value = String(text ?? "");
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`
    : value;
}

export function toProgressEntry(event) {
  const type = event?.type ?? "event";
  if (type === "step_start") {
    return {
      type,
      stream: "opencode",
      message: "开始运行 opencode",
      terminalLine: "opencode: step_start",
    };
  }
  if (type === "text") {
    return {
      type,
      stream: "opencode",
      message: "收到模型输出",
      terminalLine: "opencode: text",
    };
  }
  if (type === "step_finish") {
    const reason = event?.part?.reason ?? "unknown";
    return {
      type,
      stream: "opencode",
      message: `运行结束：${reason}`,
      terminalLine: `opencode: step_finish ${reason}`,
    };
  }
  return {
    type,
    stream: "opencode",
    message: `opencode 事件：${type}`,
    terminalLine: `opencode: ${type}`,
  };
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
  signal,
} = {}) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({
        stdout: "",
        stderr: "",
        exitCode: null,
        error: "cancelled",
      });
      return;
    }

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
    let cancelled = false;
    let lastOutputAt = Date.now();
    const commandLine = [command, ...args].join(" ");

    onProgress?.({
      type: "process_start",
      stream: "system",
      message: `启动进程：${commandLine}`,
      terminalLine: `$ ${commandLine}\ncwd: ${cwd}\npid: ${child.pid ?? "unknown"}`,
    });

    const heartbeat = setInterval(() => {
      const idleSeconds = Math.floor((Date.now() - lastOutputAt) / 1000);
      onProgress?.({
        type: "heartbeat",
        stream: "system",
        message: `进程仍在运行，${idleSeconds}s 无新输出`,
        terminalLine: `process: still running, no output for ${idleSeconds}s`,
      });
    }, 10000);

    function finish(result) {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      signal?.removeEventListener("abort", abortRun);
      resolve(result);
    }

    function abortRun() {
      if (settled) return;
      cancelled = true;
      onProgress?.({
        type: "process_cancelled",
        stream: "system",
        message: "用户取消运行",
        terminalLine: "process: cancelled by user",
      });
      terminateProcessTree(child);
    }

    signal?.addEventListener("abort", abortRun, { once: true });

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      lastOutputAt = Date.now();
      stdout += chunk;
      onProgress?.({
        type: "stdout",
        stream: "stdout",
        message: `stdout ${chunk.length} chars`,
        terminalLine: truncateTerminalLine(chunk.trimEnd()),
      });
      stdoutBuffer = readJsonEventLines(stdoutBuffer + chunk, onProgress);
    });
    child.stderr?.on("data", (chunk) => {
      lastOutputAt = Date.now();
      stderr += chunk;
      onProgress?.({
        type: "stderr",
        stream: "stderr",
        message: `stderr ${chunk.length} chars`,
        terminalLine: truncateTerminalLine(chunk.trimEnd()),
      });
    });

    child.on("error", (error) => {
      if (stdoutBuffer) {
        stdoutBuffer = readJsonEventLines(`${stdoutBuffer}\n`, onProgress);
      }
      onProgress?.({
        type: "process_error",
        stream: "system",
        message: `进程启动失败：${error.message}`,
        terminalLine: `process: error ${error.message}`,
      });
      finish({
        stdout: extractTextFromJsonEvents(stdout),
        stderr,
        exitCode: null,
        error: cancelled ? "cancelled" : error.message,
      });
    });

    child.on("close", (exitCode) => {
      if (stdoutBuffer) {
        stdoutBuffer = readJsonEventLines(`${stdoutBuffer}\n`, onProgress);
      }
      onProgress?.({
        type: "process_close",
        stream: "system",
        message: `进程退出：${exitCode}`,
        terminalLine: `process: exited with code ${exitCode}`,
      });
      finish({
        stdout: extractTextFromJsonEvents(stdout),
        stderr,
        exitCode,
        error: cancelled ? "cancelled" : null,
      });
    });

    if (prompt) {
      child.stdin?.write(prompt);
    }
    child.stdin?.end();
  });
}
