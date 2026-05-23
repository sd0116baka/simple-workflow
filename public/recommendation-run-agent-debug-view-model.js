const ROLE_BY_PROGRESS_PREFIX = Object.freeze({
  execution_: "execution",
  review_: "review",
  main_: "main",
});

const RUN_ID_PATTERN = /(execution-agent:\d+|review-agent:\d+|main-agent:(?:initialization|convergence:\d+))/;

const ROLE_LABELS = Object.freeze({
  execution: "execution",
  review: "review",
  main: "main",
});

function roleFromRunId(runId) {
  if (runId?.startsWith("execution-agent:")) return "execution";
  if (runId?.startsWith("review-agent:")) return "review";
  if (runId?.startsWith("main-agent:")) return "main";
  return "unknown";
}

function roleFromProgress(entry) {
  const type = entry?.type ?? "";
  const match = Object.entries(ROLE_BY_PROGRESS_PREFIX)
    .find(([prefix]) => type.startsWith(prefix));
  if (match) return match[1];
  const stream = entry?.stream ?? "";
  if (stream.startsWith("execution-") || stream === "execution-agent") return "execution";
  if (stream.startsWith("review-") || stream === "review-agent") return "review";
  if (stream.startsWith("main-") || stream === "main-agent") return "main";
  return null;
}

function textFromProgress(entry) {
  return `${entry?.message ?? ""}\n${entry?.terminalLine ?? ""}`;
}

function runIdFromProgress(entry) {
  return RUN_ID_PATTERN.exec(textFromProgress(entry))?.[1] ?? null;
}

function valueAfterLabel(text, label) {
  const pattern = new RegExp(`^${label}:\\s*(.+)$`, "m");
  return pattern.exec(text ?? "")?.[1]?.trim() ?? null;
}

function exitCodeFromProgress(entry) {
  const text = textFromProgress(entry);
  const match = /(?:exited with code|退出：)\s*(-?\d+)/.exec(text);
  return match ? Number(match[1]) : null;
}

function createDebugRun(runId) {
  return {
    runId,
    role: roleFromRunId(runId),
    status: "observed",
    command: null,
    cwd: null,
    pid: null,
    exitCode: null,
    sessionId: null,
    startedAt: null,
    finishedAt: null,
    lastTimestamp: null,
    lastMessage: null,
    inputArtifactRefs: [],
    outputArtifactRefs: [],
    counts: {
      events: 0,
      stdout: 0,
      stderr: 0,
      heartbeats: 0,
    },
  };
}

function ensureDebugRun(debugRuns, runId) {
  if (!debugRuns.has(runId)) {
    debugRuns.set(runId, createDebugRun(runId));
  }
  return debugRuns.get(runId);
}

function applyAgentRun(debugRun, agentRun) {
  debugRun.role = agentRun.role ?? debugRun.role;
  debugRun.status = agentRun.status ?? debugRun.status;
  debugRun.sessionId = agentRun.sessionId ?? debugRun.sessionId;
  debugRun.startedAt = agentRun.startedAt ?? debugRun.startedAt;
  debugRun.finishedAt = agentRun.finishedAt ?? debugRun.finishedAt;
  debugRun.inputArtifactRefs = agentRun.inputArtifactRefs ?? debugRun.inputArtifactRefs;
  debugRun.outputArtifactRefs = agentRun.outputArtifactRefs ?? debugRun.outputArtifactRefs;
}

function applyProgress(debugRun, entry) {
  const type = entry?.type ?? "";
  const terminalLine = entry?.terminalLine ?? "";
  debugRun.counts.events += 1;
  debugRun.lastTimestamp = entry?.timestamp ?? debugRun.lastTimestamp;
  debugRun.lastMessage = entry?.message ?? terminalLine ?? debugRun.lastMessage;

  if (type.endsWith("_process_start")) {
    debugRun.status = "running";
    debugRun.command = terminalLine.split(/\r?\n/)[0]?.replace(/^\$\s*/, "") || debugRun.command;
    debugRun.cwd = valueAfterLabel(terminalLine, "cwd") ?? debugRun.cwd;
    debugRun.pid = valueAfterLabel(terminalLine, "pid") ?? debugRun.pid;
    debugRun.startedAt = entry?.timestamp ?? debugRun.startedAt;
  } else if (type.endsWith("_process_close")) {
    debugRun.exitCode = exitCodeFromProgress(entry);
    debugRun.status = debugRun.exitCode === 0 ? "exited" : "failed";
    debugRun.finishedAt = entry?.timestamp ?? debugRun.finishedAt;
  } else if (type.endsWith("_process_error")) {
    debugRun.status = "failed";
  } else if (type.endsWith("_cancelled")) {
    debugRun.status = "cancelled";
  }

  if (type.endsWith("_stdout")) debugRun.counts.stdout += 1;
  if (type.endsWith("_stderr")) debugRun.counts.stderr += 1;
  if (type.endsWith("_heartbeat")) debugRun.counts.heartbeats += 1;
}

function collectFinalAgentRuns(recommendationRun, taskContextPackage) {
  const finalPackage = recommendationRun?.taskContextPackage ?? taskContextPackage;
  return [
    ...(finalPackage?.agentRuns ?? []),
  ];
}

function sortDebugRuns(debugRuns) {
  return [...debugRuns].sort((left, right) =>
    String(left.startedAt ?? left.lastTimestamp ?? "").localeCompare(
      String(right.startedAt ?? right.lastTimestamp ?? ""),
    ));
}

export function buildRecommendationRunAgentDebugViewModel(recommendationRun, {
  taskContextPackage = null,
} = {}) {
  if (!recommendationRun && !taskContextPackage) {
    return {
      statusText: "未运行",
      emptyText: "尚未启动真实 agent。",
      runs: [],
    };
  }

  const debugRuns = new Map();
  const currentRunByRole = new Map();
  for (const entry of recommendationRun?.progress ?? []) {
    const explicitRunId = runIdFromProgress(entry);
    const role = explicitRunId ? roleFromRunId(explicitRunId) : roleFromProgress(entry);
    const runId = explicitRunId ?? currentRunByRole.get(role);
    if (!runId) continue;
    currentRunByRole.set(role, runId);
    const debugRun = ensureDebugRun(debugRuns, runId);
    if (role && debugRun.role === "unknown") debugRun.role = role;
    applyProgress(debugRun, entry);
  }

  for (const agentRun of collectFinalAgentRuns(recommendationRun, taskContextPackage)) {
    const debugRun = ensureDebugRun(debugRuns, agentRun.runId);
    applyAgentRun(debugRun, agentRun);
  }

  const runs = sortDebugRuns(debugRuns.values());
  const runningCount = runs.filter((run) => run.status === "running").length;
  const failedCount = runs.filter((run) => run.status === "failed").length;
  const completedCount = runs.filter((run) =>
    ["succeeded", "exited"].includes(run.status)).length;

  return {
    statusText: runs.length === 0
      ? "等待 agent"
      : `${runs.length} 个 agent run · running ${runningCount} · done ${completedCount} · failed ${failedCount}`,
    emptyText: "尚未观察到真实 agent 进程。",
    runs: runs.map((run) => ({
      ...run,
      roleLabel: ROLE_LABELS[run.role] ?? run.role,
    })),
  };
}
