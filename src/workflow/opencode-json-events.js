export function toOpencodeProgressEntry(event) {
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

export function findSessionIdInJsonEvents(output) {
  const lines = String(output ?? "").split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const candidates = [
      event.sessionId,
      event.sessionID,
      event.session?.id,
      event.properties?.sessionId,
      event.properties?.sessionID,
    ].filter((value) => typeof value === "string" && value.length > 0);
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

export function readJsonEventLines(buffer, onEvent) {
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
    onEvent?.(toOpencodeProgressEntry(event), event);
  }

  return rest;
}
