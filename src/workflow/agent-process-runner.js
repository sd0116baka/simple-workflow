import { spawn, spawnSync } from "node:child_process";
import { createAgentProcessProgressEntries } from "./agent-process-progress.js";

function emitProgress(onProgress, entry) {
  if (entry) onProgress?.(entry);
}

function terminateProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  child.kill("SIGTERM");
}

export function runAgentProcess({
  command,
  args = [],
  cwd = process.cwd(),
  env = process.env,
  shell = process.platform === "win32",
  prompt = null,
  signal,
  onProgress,
  onStdoutChunk,
  beforeFinish,
  progressEntries = {},
} = {}) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({
        stdout: "",
        stderr: "",
        exitCode: null,
        error: "cancelled",
        cancelled: true,
      });
      return;
    }

    const child = spawn(command, args, {
      cwd,
      env,
      shell,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let cancelled = false;
    let lastOutputAt = Date.now();
    const commandLine = [command, ...args].join(" ");

    const entries = {
      ...createAgentProcessProgressEntries(),
      ...progressEntries,
    };

    emitProgress(onProgress, entries.start?.({
      commandLine,
      cwd,
      pid: child.pid,
    }));

    const heartbeat = setInterval(() => {
      const idleSeconds = Math.floor((Date.now() - lastOutputAt) / 1000);
      emitProgress(onProgress, entries.heartbeat?.({ idleSeconds }));
    }, 10000);

    function finish({ exitCode = null, error = null } = {}) {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      signal?.removeEventListener("abort", abortRun);
      beforeFinish?.();
      resolve({
        stdout,
        stderr,
        exitCode,
        error: cancelled ? "cancelled" : error,
        cancelled,
      });
    }

    function abortRun() {
      if (settled) return;
      cancelled = true;
      emitProgress(onProgress, entries.cancelled?.());
      terminateProcessTree(child);
    }

    signal?.addEventListener("abort", abortRun, { once: true });

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      lastOutputAt = Date.now();
      stdout += chunk;
      emitProgress(onProgress, entries.stdout?.({ chunk }));
      onStdoutChunk?.(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      lastOutputAt = Date.now();
      stderr += chunk;
      emitProgress(onProgress, entries.stderr?.({ chunk }));
    });
    child.on("error", (error) => {
      emitProgress(onProgress, entries.error?.({ error }));
      finish({ error: error.message });
    });
    child.on("close", (exitCode) => {
      emitProgress(onProgress, entries.close?.({ exitCode }));
      finish({ exitCode });
    });

    if (prompt) {
      child.stdin?.write(prompt);
    }
    child.stdin?.end();
  });
}
