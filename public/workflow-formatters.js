export function stripAnsi(text) {
  return String(text ?? "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

export function formatElapsed(startedAt, finishedAt = null, now = () => Date.now()) {
  if (!startedAt) return "--:--";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "--:--";
  const totalSeconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatProgress(progress) {
  return (progress ?? [])
    .map((entry) => {
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--:--:--";
      return `${time} ${entry.message}`;
    })
    .join("\n");
}

export function formatTerminalProgress(run) {
  if (!run) return "尚未启动进程。";
  const lines = [
    `run: ${run.id ?? "unknown"}`,
    `status: ${run.status ?? "unknown"} · elapsed: ${formatElapsed(run.startedAt, run.finishedAt)}`,
    `command: ${run.command ? [run.command, ...(run.args ?? [])].join(" ") : "未启动外部命令"}`,
    "",
  ];
  const progress = run.progress ?? [];
  if (progress.length === 0) {
    lines.push(run.status === "running"
      ? "process: 已请求启动，等待首个终端事件..."
      : "process: 无终端事件。");
  }
  for (const entry of progress) {
    const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--:--:--";
    const stream = entry.stream ?? entry.type ?? "event";
    const terminalLine = stripAnsi(entry.terminalLine ?? entry.message ?? "");
    lines.push(`[${time}] [${stream}] ${terminalLine}`);
  }
  if (run.status === "running" && progress.length > 0) {
    lines.push("");
    lines.push("process: running, waiting for next output...");
  }
  return lines.join("\n");
}

export function formatJsonBlock(value) {
  return value ? JSON.stringify(value, null, 2) : "未生成。";
}
