import {
  stageDefinition,
  timestampFromArtifact,
} from "./stage-timeline-definitions.js";
import { artifactRecord } from "./task-package-artifacts.js";

function initialNode(taskContextPackage) {
  const { label, transition } = stageDefinition("task-pool");
  return {
    stage: "task-pool",
    label,
    transition,
    evidence: taskContextPackage?.packageId ?? "taskContextPackage",
    timestamp: taskContextPackage?.fixture?.generatedAt
      ?? taskContextPackage?.timeline?.[0]?.appendedAt
      ?? null,
    status: "completed",
    detail: taskContextPackage?.packageId ?? "taskContextPackage",
  };
}

function terminalNode(taskContextPackage) {
  const closeout = artifactRecord(taskContextPackage, "taskCloseout");
  const finalStage = closeout?.body?.finalStage;
  if (!["closed", "cancelled"].includes(finalStage)) return null;
  const { label, transition } = stageDefinition(finalStage);
  return {
    stage: finalStage,
    label,
    transition,
    evidence: "taskCloseout",
    timestamp: timestampFromArtifact(closeout),
    status: "completed",
    detail: "taskCloseout",
  };
}

function fallbackCurrentNode(taskContextPackage, nodes) {
  const currentStage = taskContextPackage?.currentWorkStage;
  if (!currentStage || nodes.some((node) => node.stage === currentStage)) return null;
  const { label, transition } = stageDefinition(currentStage);
  return {
    stage: currentStage,
    label,
    transition,
    evidence: currentStage,
    timestamp: null,
    status: "current",
    detail: "当前环节",
  };
}

function markCurrentNode(nodes, currentStage) {
  const nextNodes = nodes.map((node) => ({ ...node, status: "completed", detail: node.evidence }));
  const currentIndex = currentStage
    ? nextNodes.findLastIndex((node) => node.stage === currentStage)
    : nextNodes.length - 1;
  if (currentIndex >= 0) {
    nextNodes[currentIndex] = {
      ...nextNodes[currentIndex],
      status: "current",
      detail: `当前 · ${nextNodes[currentIndex].evidence}`,
    };
  }
  return nextNodes;
}

function buildTransitions(nodes) {
  return nodes.slice(0, -1).map((node, index) => {
    const nextNode = nodes[index + 1];
    return {
      from: node.stage,
      to: nextNode.stage,
      label: node.transition,
      status: "completed",
    };
  });
}

export function assembleStageTimelineNodes({
  taskContextPackage,
  timelineNodes = [],
} = {}) {
  const terminal = terminalNode(taskContextPackage);
  const baseNodes = [
    initialNode(taskContextPackage),
    ...timelineNodes,
    ...(terminal ? [terminal] : []),
  ];
  const fallback = fallbackCurrentNode(taskContextPackage, baseNodes);
  const nodes = markCurrentNode(
    fallback ? [...baseNodes, fallback] : baseNodes,
    taskContextPackage?.currentWorkStage,
  );

  return {
    nodes,
    transitions: buildTransitions(nodes),
  };
}
