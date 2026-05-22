import {
  formatElapsed,
  stripAnsi,
} from "./workflow-formatters.js";

function formatTerminalSessionOutput(terminalSession) {
  if (!terminalSession) return "尚未启动终端。";
  const lines = [
    `session: ${terminalSession.id}`,
    `status: ${terminalSession.status} · elapsed: ${formatElapsed(
      terminalSession.startedAt,
      terminalSession.finishedAt,
    )}`,
    `command: ${[terminalSession.command, ...(terminalSession.args ?? [])].join(" ")}`,
    "",
  ];

  for (const entry of terminalSession.output ?? []) {
    const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "--:--:--";
    lines.push(`[${time}] [${entry.stream ?? "event"}] ${stripAnsi(entry.text ?? "")}`);
  }
  if (terminalSession.status === "running") {
    lines.push("");
    lines.push("process: running");
  }
  return lines.join("\n");
}

export function renderTerminalSession({
  elements,
  terminalSession,
} = {}) {
  const running = terminalSession?.status === "running";
  if (elements.terminalStatus) {
    elements.terminalStatus.textContent = terminalSession
      ? `${terminalSession.status} · ${terminalSession.id}`
      : "未连接";
  }
  if (elements.terminalOutput) {
    elements.terminalOutput.textContent = formatTerminalSessionOutput(terminalSession);
    elements.terminalOutput.scrollTop = elements.terminalOutput.scrollHeight;
  }
  if (elements.terminalStartButton) {
    elements.terminalStartButton.disabled = running;
  }
  if (elements.terminalCancelButton) {
    elements.terminalCancelButton.disabled = !running;
  }
  if (elements.terminalSendButton) {
    elements.terminalSendButton.disabled = !running;
  }
  if (elements.terminalInput) {
    elements.terminalInput.disabled = !running;
  }
}

export function createWorkflowTerminalRenderer() {
  return {
    render: renderTerminalSession,
  };
}
