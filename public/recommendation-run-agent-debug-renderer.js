import { buildRecommendationRunAgentDebugViewModel } from "./recommendation-run-agent-debug-view-model.js";

function appendText(documentRef, parent, className, text) {
  const element = documentRef.createElement("span");
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function appendMeta(documentRef, parent, label, value) {
  if (value === null || value === undefined || value === "") return;
  const item = documentRef.createElement("div");
  item.className = "agent-debug-meta-item";
  appendText(documentRef, item, "agent-debug-label", label);
  appendText(documentRef, item, "agent-debug-value", String(value));
  parent.append(item);
}

function appendCard(documentRef, parent, run) {
  const card = documentRef.createElement("article");
  card.className = `agent-debug-card ${run.status}`;

  const header = documentRef.createElement("div");
  header.className = "agent-debug-card-header";
  appendText(documentRef, header, "agent-debug-run-id", run.runId);
  appendText(documentRef, header, "agent-debug-status", run.status);
  card.append(header);

  const meta = documentRef.createElement("div");
  meta.className = "agent-debug-meta";
  appendMeta(documentRef, meta, "role", run.roleLabel);
  appendMeta(documentRef, meta, "pid", run.pid);
  appendMeta(documentRef, meta, "exit", run.exitCode);
  appendMeta(documentRef, meta, "session", run.sessionId);
  appendMeta(documentRef, meta, "cwd", run.cwd);
  appendMeta(documentRef, meta, "command", run.command);
  appendMeta(documentRef, meta, "started", run.startedAt);
  appendMeta(documentRef, meta, "finished", run.finishedAt);
  card.append(meta);

  const counters = documentRef.createElement("div");
  counters.className = "agent-debug-counters";
  appendText(documentRef, counters, "agent-debug-counter", `events ${run.counts.events}`);
  appendText(documentRef, counters, "agent-debug-counter", `stdout ${run.counts.stdout}`);
  appendText(documentRef, counters, "agent-debug-counter", `stderr ${run.counts.stderr}`);
  appendText(documentRef, counters, "agent-debug-counter", `heartbeats ${run.counts.heartbeats}`);
  card.append(counters);

  if (run.inputArtifactRefs.length > 0 || run.outputArtifactRefs.length > 0) {
    const refs = documentRef.createElement("div");
    refs.className = "agent-debug-refs";
    appendMeta(documentRef, refs, "input", run.inputArtifactRefs.join(", "));
    appendMeta(documentRef, refs, "output", run.outputArtifactRefs.join(", "));
    card.append(refs);
  }

  if (run.lastMessage) {
    const last = documentRef.createElement("p");
    last.className = "agent-debug-last";
    last.textContent = run.lastMessage;
    card.append(last);
  }

  parent.append(card);
}

export function renderRecommendationRunAgentDebug({
  documentRef,
  elements,
  recommendationRun,
  taskContextPackage,
} = {}) {
  const viewModel = buildRecommendationRunAgentDebugViewModel(recommendationRun, {
    taskContextPackage,
  });
  if (elements?.agentDebugStatus) {
    elements.agentDebugStatus.textContent = viewModel.statusText;
  }
  if (!elements?.agentDebugPanel) return viewModel;

  elements.agentDebugPanel.replaceChildren();
  if (viewModel.runs.length === 0) {
    elements.agentDebugPanel.textContent = viewModel.emptyText;
    return viewModel;
  }

  const resolvedDocument =
    documentRef ??
    elements.agentDebugPanel.ownerDocument ??
    elements.agentDebugStatus?.ownerDocument ??
    globalThis.document;

  if (!resolvedDocument) return viewModel;

  for (const run of viewModel.runs) {
    appendCard(resolvedDocument, elements.agentDebugPanel, run);
  }
  return viewModel;
}
