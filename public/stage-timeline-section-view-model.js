import { buildStageTimeline } from "./stage-timeline.js";

export function formatStageTimestamp(node) {
  if (node.status === "skipped") return "未进入";
  if (!node.timestamp) return node.status === "pending" ? "未发生" : "无时间";
  const date = new Date(node.timestamp);
  if (Number.isNaN(date.getTime())) return node.timestamp;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function buildStageTimelineSectionViewModel(taskContextPackage) {
  if (!taskContextPackage) {
    return {
      statusText: "等待任务包",
      emptyText: "等待任务上下文包。",
      nodes: [],
      transitions: [],
      notes: [],
    };
  }

  const timeline = buildStageTimeline(taskContextPackage);
  const currentNode = timeline.nodes.find((node) => node.stage === timeline.currentStage);
  const completedCount = timeline.nodes.filter((node) =>
    ["completed", "current"].includes(node.status),
  ).length;

  return {
    statusText: `${currentNode?.label ?? timeline.currentStage} · ${completedCount}/${timeline.nodes.length}`,
    emptyText: null,
    nodes: timeline.nodes.map((node, index) => ({
      className: `stage-timeline-node ${node.status}`,
      indexText: String(index + 1).padStart(2, "0"),
      label: node.label,
      stage: node.stage,
      timestampText: formatStageTimestamp(node),
      detail: node.detail,
    })),
    transitions: timeline.transitions.map((transition) => ({
      className: `stage-timeline-connector ${transition.status}`,
      iconText: "→",
      label: transition.label ?? "",
    })),
    notes: timeline.notes.map((note) => `${note.label}: ${note.text}`),
  };
}
