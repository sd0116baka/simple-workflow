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

  function createTerminalSession({
    command,
    args = [],
    cwd = repositoryDir,
    title = null,
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

    const child = spawnProcess(session.command, session.args, {
      cwd: session.cwd,
      env,
      shell,
      windowsHide: true,
    });
    session.child = child;
    appendOutput(session, {
      stream: "system",
      text: `$ ${[session.command, ...session.args].join(" ")}\ncwd: ${session.cwd}\npid: ${child.pid ?? "unknown"}`,
    });

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      appendOutput(session, { stream: "stdout", text: chunk });
    });
    child.stderr?.on("data", (chunk) => {
      appendOutput(session, { stream: "stderr", text: chunk });
    });
    child.on("error", (error) => {
      appendOutput(session, { stream: "system", text: `error: ${error.message}` });
      finishSession(session, { error: error.message });
    });
    child.on("close", (exitCode) => {
      appendOutput(session, { stream: "system", text: `exited with code ${exitCode}` });
      finishSession(session, { exitCode });
    });

    return snapshotSession(session);
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
    writeTerminalSessionInput,
  };
}
