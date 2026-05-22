import { spawn, spawnSync } from "node:child_process";

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

function trimOutput(output, maxOutputEntries) {
  if (output.length <= maxOutputEntries) return output;
  return output.slice(output.length - maxOutputEntries);
}

function snapshotSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    title: session.title,
    command: session.command,
    args: [...session.args],
    cwd: session.cwd,
    status: session.status,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    exitCode: session.exitCode,
    error: session.error,
    output: session.output.map((entry) => ({ ...entry })),
  };
}

function buildCommandLine({ command, args }) {
  return [command, ...args].join(" ");
}

export function createTerminalSessionService({
  repositoryDir = process.cwd(),
  env = process.env,
  now = () => new Date().toISOString(),
  spawnProcess = spawn,
  emitTerminalSessionChanged = () => {},
  idPrefix = "terminal-session",
  maxOutputEntries = 500,
  shell = process.platform === "win32",
} = {}) {
  const sessions = new Map();
  let sequence = 0;
  let latestSessionId = null;

  function emit(session) {
    emitTerminalSessionChanged(snapshotSession(session));
  }

  function nextSessionId() {
    sequence += 1;
    return `${idPrefix}-${sequence}`;
  }

  function requireSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }
    return session;
  }

  function appendOutput(session, { stream, text }) {
    if (!text) return;
    session.output.push({
      stream,
      text: String(text),
      timestamp: now(),
    });
    session.output = trimOutput(session.output, maxOutputEntries);
    emit(session);
  }

  function finishSession(session, { exitCode = null, error = null, status = null } = {}) {
    if (session.status !== "running") return;
    session.status = status ?? (error ? "failed" : "exited");
    session.finishedAt = now();
    session.exitCode = exitCode;
    session.error = error;
    emit(session);
  }

  function startTerminalProcess({
    command,
    args = [],
    cwd = repositoryDir,
    env: processEnv = env,
    title = null,
    prompt = null,
    closeStdin = false,
    signal = null,
    onStarted,
    onStdoutChunk,
    onStderrChunk,
    onFinish,
  } = {}) {
    if (!command || typeof command !== "string") {
      throw new Error("command is required");
    }
    if (!Array.isArray(args)) {
      throw new Error("args must be an array");
    }

    const session = {
      id: nextSessionId(),
      title: title ?? command,
      command,
      args: args.map(String),
      cwd,
      status: "running",
      startedAt: now(),
      finishedAt: null,
      exitCode: null,
      error: null,
      output: [],
      child: null,
    };
    sessions.set(session.id, session);
    latestSessionId = session.id;

    let stdout = "";
    let stderr = "";
    let settled = false;
    let cancelled = false;
    let resolveDone;
    const done = new Promise((resolve) => {
      resolveDone = resolve;
    });

    function settle(result = {}) {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abortRun);
      onFinish?.();
      resolveDone({
        stdout,
        stderr,
        exitCode: result.exitCode ?? null,
        error: cancelled ? "cancelled" : result.error ?? null,
        cancelled,
        terminalSession: snapshotSession(session),
      });
    }

    function abortRun() {
      if (settled) return;
      cancelled = true;
      appendOutput(session, { stream: "system", text: "cancel requested" });
      terminateProcessTree(session.child);
      finishSession(session, { status: "cancelled", error: "cancelled" });
      settle({ error: "cancelled" });
    }

    if (signal?.aborted) {
      session.status = "cancelled";
      session.finishedAt = now();
      session.error = "cancelled";
      emit(session);
      settle({ error: "cancelled" });
      return { session, done };
    }

    const child = spawnProcess(session.command, session.args, {
      cwd: session.cwd,
      env: processEnv,
      shell,
      windowsHide: true,
    });
    session.child = child;
    appendOutput(session, {
      stream: "system",
      text: `$ ${buildCommandLine(session)}\ncwd: ${session.cwd}\npid: ${child.pid ?? "unknown"}`,
    });
    onStarted?.(snapshotSession(session));
    signal?.addEventListener("abort", abortRun, { once: true });

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
      appendOutput(session, { stream: "stdout", text: chunk });
      onStdoutChunk?.(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      appendOutput(session, { stream: "stderr", text: chunk });
      onStderrChunk?.(chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      appendOutput(session, { stream: "system", text: `error: ${error.message}` });
      finishSession(session, { error: error.message });
      settle({ error: error.message });
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      appendOutput(session, { stream: "system", text: `exited with code ${exitCode}` });
      finishSession(session, { exitCode });
      settle({ exitCode });
    });

    if (prompt) {
      child.stdin?.write(prompt);
    }
    if (closeStdin) {
      child.stdin?.end();
    }

    return { session, done };
  }

  function createTerminalSession(input = {}) {
    const { session } = startTerminalProcess(input);
    return snapshotSession(session);
  }

  function runTerminalCommand(input = {}) {
    const { done } = startTerminalProcess({
      ...input,
      closeStdin: input.closeStdin ?? true,
    });
    return done;
  }

  function writeTerminalSessionInput({ sessionId, input } = {}) {
    const session = requireSession(sessionId);
    if (session.status !== "running") {
      throw new Error(`Terminal session is not running: ${sessionId}`);
    }
    const text = String(input ?? "");
    session.child.stdin?.write(text);
    appendOutput(session, { stream: "stdin", text });
    return snapshotSession(session);
  }

  function cancelTerminalSession({ sessionId } = {}) {
    const session = requireSession(sessionId);
    if (session.status !== "running") {
      return snapshotSession(session);
    }
    appendOutput(session, { stream: "system", text: "cancel requested" });
    terminateProcessTree(session.child);
    finishSession(session, { status: "cancelled", error: "cancelled" });
    return snapshotSession(session);
  }

  function getLatestTerminalSession() {
    return snapshotSession(sessions.get(latestSessionId));
  }

  function getTerminalSession({ sessionId } = {}) {
    return snapshotSession(requireSession(sessionId));
  }

  return {
    cancelTerminalSession,
    createTerminalSession,
    getLatestTerminalSession,
    getTerminalSession,
    runTerminalCommand,
    writeTerminalSessionInput,
  };
}
