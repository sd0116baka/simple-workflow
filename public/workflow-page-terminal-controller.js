export function parseTerminalArgs(argsText = "") {
  return String(argsText)
    .split(/\s+/)
    .map((arg) => arg.trim())
    .filter(Boolean);
}

export function createWorkflowPageTerminalController({
  workflowApi,
  elements,
  terminalRenderer = { render() {} },
} = {}) {
  let terminalSession = null;

  function renderTerminalSession() {
    terminalRenderer.render({ elements, terminalSession });
  }

  function setTerminalSession(nextTerminalSession) {
    terminalSession = nextTerminalSession ?? null;
    renderTerminalSession();
  }

  async function loadTerminalSession() {
    const payload = await workflowApi.loadLatestTerminalSession();
    setTerminalSession(payload.terminalSession);
  }

  async function startTerminalSession() {
    const payload = await workflowApi.startTerminalSession({
      command: elements.terminalCommandInput?.value?.trim(),
      args: parseTerminalArgs(elements.terminalArgsInput?.value),
    });
    setTerminalSession(payload.terminalSession);
  }

  async function sendTerminalInput() {
    if (!terminalSession?.id) return;
    const value = elements.terminalInput?.value ?? "";
    const input = value.endsWith("\n") ? value : `${value}\n`;
    const payload = await workflowApi.writeTerminalSessionInput({
      sessionId: terminalSession.id,
      input,
    });
    if (elements.terminalInput) elements.terminalInput.value = "";
    setTerminalSession(payload.terminalSession);
  }

  async function cancelTerminalSession() {
    if (!terminalSession?.id) return;
    const payload = await workflowApi.cancelTerminalSession({
      sessionId: terminalSession.id,
    });
    setTerminalSession(payload.terminalSession);
  }

  return {
    cancelTerminalSession,
    getTerminalSession: () => terminalSession,
    loadTerminalSession,
    renderTerminalSession,
    sendTerminalInput,
    setTerminalSession,
    startTerminalSession,
  };
}
