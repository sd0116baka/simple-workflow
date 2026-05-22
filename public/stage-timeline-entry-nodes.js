import { artifactById } from "./task-package-artifacts.js";
import {
  stageDefinition,
  stageFromAgentRun,
  stageFromArtifactType,
  timestampFromAgentRun,
  timestampFromArtifact,
} from "./stage-timeline-definitions.js";

function agentRunById(taskContextPackage, runId) {
  return (taskContextPackage?.agentRuns ?? []).find((agentRun) => agentRun.runId === runId) ?? null;
}

function stageFromTimelineEntry(taskContextPackage, entry) {
  if (entry.agentRunId) {
    return stageFromAgentRun(agentRunById(taskContextPackage, entry.agentRunId));
  }
  return stageFromArtifactType(entry.artifactType);
}

function evidenceFromTimelineEntry(taskContextPackage, entry) {
  if (entry.agentRunId) return entry.agentRunId;
  if (entry.artifactId) return entry.artifactId;
  return entry.artifactType ?? taskContextPackage?.packageId ?? "taskContextPackage";
}

function timestampFromTimelineEntry(taskContextPackage, entry) {
  if (entry.agentRunId) {
    return timestampFromAgentRun(agentRunById(taskContextPackage, entry.agentRunId))
      ?? entry.appendedAt
      ?? null;
  }
  if (entry.artifactId) {
    return timestampFromArtifact(artifactById(taskContextPackage, entry.artifactId)?.artifact)
      ?? entry.appendedAt
      ?? null;
  }
  return entry.appendedAt ?? null;
}

function nodeFromTimelineEntry(taskContextPackage, entry, index) {
  const stage = stageFromTimelineEntry(taskContextPackage, entry);
  if (!stage) return null;
  const { label, transition } = stageDefinition(stage);
  const evidence = evidenceFromTimelineEntry(taskContextPackage, entry);
  return {
    stage,
    label,
    transition,
    evidence,
    timestamp: timestampFromTimelineEntry(taskContextPackage, entry),
    status: "completed",
    detail: evidence,
    timelineIndex: index,
  };
}

function coalesceAdjacentImplementationDetails(nodes) {
  const result = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const nextNode = nodes[index + 1];
    if (node.stage === "human-decision" && nextNode?.stage === "human-decision") {
      result.push({
        ...nextNode,
        evidence: `${node.evidence} -> ${nextNode.evidence}`,
        detail: `${node.evidence} -> ${nextNode.evidence}`,
        timestamp: nextNode.timestamp ?? node.timestamp,
      });
      index += 1;
      continue;
    }
    if (
      ["execution-agent", "review-agent"].includes(node.stage)
      && nextNode?.stage === node.stage
      && nextNode.evidence?.includes("-agent:")
    ) {
      result.push(nextNode);
      index += 1;
      continue;
    }
    if (
      node.stage === "convergence"
      && nextNode?.stage === "convergence"
      && nextNode.evidence?.startsWith("main-agent:convergence")
    ) {
      result.push(node);
      index += 1;
      continue;
    }
    result.push(node);
  }
  return result;
}

export function buildStageTimelineEntryNodes(taskContextPackage) {
  return coalesceAdjacentImplementationDetails((taskContextPackage?.timeline ?? [])
    .map((entry, index) => nodeFromTimelineEntry(taskContextPackage, entry, index))
    .filter(Boolean));
}
