import { buildStageTimelineEntryNodes } from "./stage-timeline-entry-nodes.js";
import { assembleStageTimelineNodes } from "./stage-timeline-node-assembly.js";
import { latestArtifactRecord } from "./task-package-artifacts.js";

function correctionNotes(taskContextPackage) {
  const guidance = latestArtifactRecord(taskContextPackage, "humanConvergenceGuidance");
  if (!guidance) return [];
  const target = guidance.body?.targetRef ?? guidance.body?.convergenceSuccessRef ?? "unknown";
  return [{
    kind: "feedback-loop",
    label: "人工意见回环",
    text: `human-decision -> execution-agent · ${guidance.artifactId} · target: ${target}`,
  }];
}

export function buildStageTimeline(taskContextPackage) {
  if (!taskContextPackage) {
    return {
      currentStage: null,
      nodes: [],
      transitions: [],
      notes: [],
    };
  }

  const timelineNodes = buildStageTimelineEntryNodes(taskContextPackage);
  const { nodes, transitions } = assembleStageTimelineNodes({
    taskContextPackage,
    timelineNodes,
  });

  return {
    currentStage: taskContextPackage.currentWorkStage,
    nodes,
    transitions,
    notes: correctionNotes(taskContextPackage),
  };
}
