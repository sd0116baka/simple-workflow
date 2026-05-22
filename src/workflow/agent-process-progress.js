function processType(typePrefix, eventName) {
  return `${typePrefix}${eventName}`;
}

function truncateTerminalLine(text, maxLength = 4000) {
  const value = String(text ?? "");
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`
    : value;
}

export function createAgentProcessProgressEntries({
  typePrefix = "",
  systemStream = "system",
  stdoutStream = "stdout",
  stderrStream = "stderr",
  subject = "",
  terminalSubject = subject || "process",
} = {}) {
  return {
    start({ commandLine, cwd, pid }) {
      const subjectLine = subject ? `\nrunId: ${subject}` : "";
      return {
        type: processType(typePrefix, "process_start"),
        stream: systemStream,
        message: subject
          ? `启动 ${subject}：${commandLine}`
          : `启动进程：${commandLine}`,
        terminalLine: `$ ${commandLine}\ncwd: ${cwd}${subjectLine}\npid: ${pid ?? "unknown"}`,
      };
    },
    heartbeat({ idleSeconds }) {
      return {
        type: processType(typePrefix, "heartbeat"),
        stream: systemStream,
        message: subject
          ? `${subject} 仍在运行，${idleSeconds}s 无新输出`
          : `进程仍在运行，${idleSeconds}s 无新输出`,
        terminalLine: `${terminalSubject}: still running, no output for ${idleSeconds}s`,
      };
    },
    cancelled() {
      return {
        type: processType(typePrefix, "process_cancelled"),
        stream: systemStream,
        message: subject ? `${subject} 已由用户取消` : "用户取消运行",
        terminalLine: `${terminalSubject}: cancelled by user`,
      };
    },
    stdout({ chunk }) {
      return {
        type: processType(typePrefix, "stdout"),
        stream: stdoutStream,
        message: subject
          ? `${subject} stdout ${chunk.length} chars`
          : `stdout ${chunk.length} chars`,
        terminalLine: truncateTerminalLine(chunk.trimEnd()),
      };
    },
    stderr({ chunk }) {
      return {
        type: processType(typePrefix, "stderr"),
        stream: stderrStream,
        message: subject
          ? `${subject} stderr ${chunk.length} chars`
          : `stderr ${chunk.length} chars`,
        terminalLine: truncateTerminalLine(chunk.trimEnd()),
      };
    },
    error({ error }) {
      return {
        type: processType(typePrefix, "process_error"),
        stream: systemStream,
        message: subject
          ? `${subject} 启动失败：${error.message}`
          : `进程启动失败：${error.message}`,
        terminalLine: `${terminalSubject}: error ${error.message}`,
      };
    },
    close({ exitCode }) {
      return {
        type: processType(typePrefix, "process_close"),
        stream: systemStream,
        message: subject
          ? `${subject} 退出：${exitCode}`
          : `进程退出：${exitCode}`,
        terminalLine: `${terminalSubject}: exited with code ${exitCode}`,
      };
    },
  };
}
