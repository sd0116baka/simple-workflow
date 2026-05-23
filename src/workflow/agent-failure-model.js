const ROLE_LABELS = Object.freeze({
  execution: "execution agent",
  review: "review agent",
  main: "main agent",
});

function roleLabel(role) {
  return ROLE_LABELS[role] ?? "agent";
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function stderrSnippet(stderr) {
  const text = cleanText(stderr);
  if (!text) return null;
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

export function buildAgentProcessFailure({
  role,
  exitCode = null,
  error = null,
  cancelled = false,
  stderr = "",
} = {}) {
  if (cancelled || error === "cancelled") {
    return {
      code: "agent.cancelled",
      kind: "cancelled",
      message: `${roleLabel(role)} 已取消。`,
      exitCode: null,
      error: "cancelled",
      stderr: null,
    };
  }

  if (error) {
    return {
      code: "agent.process-error",
      kind: "process-error",
      message: cleanText(error),
      exitCode,
      error: cleanText(error),
      stderr: stderrSnippet(stderr),
    };
  }

  if (exitCode !== null && exitCode !== undefined && exitCode !== 0) {
    const stderrText = stderrSnippet(stderr);
    return {
      code: "agent.non-zero-exit",
      kind: "non-zero-exit",
      message: stderrText ?? `${roleLabel(role)} 进程退出码 ${exitCode}。`,
      exitCode,
      error: null,
      stderr: stderrText,
    };
  }

  return null;
}

export function normalizeAgentProcessStatus(input = {}) {
  const failure = input.failure ?? buildAgentProcessFailure(input);
  if (!failure) return "succeeded";
  return failure.kind === "cancelled" ? "cancelled" : "failed";
}

export function agentSessionFailure(session = {}) {
  const processFailure = session.failure ?? buildAgentProcessFailure({
    role: session.role,
    exitCode: session.rawOutput?.exitCode ?? null,
    error: session.rawOutput?.error ?? null,
    cancelled: session.status === "cancelled",
    stderr: session.rawOutput?.stderr ?? "",
  });
  if (processFailure) return processFailure;
  if (session.status === "failed") {
    return buildAgentProcessFailure({
      role: session.role,
      error: `${roleLabel(session.role)} 运行失败。`,
    });
  }
  return null;
}

export function agentSessionErrorMessage(session = {}, fallback = "agent 运行失败。") {
  return agentSessionFailure(session)?.message ?? fallback;
}
