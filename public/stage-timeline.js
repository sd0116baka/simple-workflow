const STAGE_DEFINITIONS = {
  "task-pool": { label: "任务池", transition: "任务入池" },
  "task-recommender": { label: "任务推荐器", transition: "选中候选任务" },
  "execution-admission": { label: "执行准入器", transition: "授权或拒绝" },
  "isolated-workspace": { label: "隔离工作树", transition: "分配执行环境" },
  "main-agent": { label: "Main Agent", transition: "初始化会话" },
  "execution-agent": { label: "Execution Agent", transition: "执行任务" },
  "review-agent": { label: "Review Agent", transition: "审查执行结果" },
  convergence: { label: "收敛判断", transition: "判断下一步" },
  "human-decision": { label: "人工决策", transition: "人工选择" },
  "auto-merge-planning": { label: "合并前置校验", transition: "生成合并计划" },
  "auto-merge-execution": { label: "自动合并执行", transition: "执行合并" },
  merged: { label: "已合入", transition: "进入收尾" },
  "task-closeout": { label: "任务收尾", transition: "清理执行资源" },
  closed: { label: "已关闭", transition: null },
  cancelled: { label: "已取消", transition: null },
};

const ARTIFACT_STAGE = {
  executionIntent: "task-recommender",
  executionAuthorization: "execution-admission",
  admissionRejection: "execution-admission",
  isolatedWorkspace: "isolated-workspace",
  convergenceAdvice: "convergence",
  convergenceSuccess: "convergence",
  convergenceFailure: "convergence",
  humanDecisionRequest: "human-decision",
  humanConvergenceGuidance: "human-decision",
  humanDecision: "human-decision",
  autoMergePlan: "auto-merge-planning",
  autoMergeRejection: "auto-merge-planning",
  autoMergeResult: "auto-merge-execution",
  autoMergeFailure: "auto-merge-execution",
  taskCloseout: "task-closeout",
};

function artifactRecords(artifactValue) {
  if (Array.isArray(artifactValue)) return artifactValue;
  return artifactValue ? [artifactValue] : [];
}

function allArtifacts(taskContextPackage) {
  return Object.entries(taskContextPackage?.artifacts ?? {}).flatMap(([artifactType, value]) =>
    artifactRecords(value).map((artifact) => ({ artifactType, artifact })),
  );
}

function artifactById(taskContextPackage, artifactId) {
  return allArtifacts(taskContextPackage).find((item) => item.artifact?.artifactId === artifactId) ?? null;
}

function latestArtifact(taskContextPackage, artifactType) {
  const records = artifactRecords(taskContextPackage?.artifacts?.[artifactType]);
  return records.length > 0 ? records[records.length - 1] : null;
}

function agentRunById(taskContextPackage, runId) {
  return (taskContextPackage?.agentRuns ?? []).find((agentRun) => agentRun.runId === runId) ?? null;
}

function stageDefinition(stage) {
  return STAGE_DEFINITIONS[stage] ?? { label: stage, transition: null };
}

function timestampFromArtifact(artifact) {
  return artifact?.appendedAt
    ?? artifact?.body?.requestedAt
    ?? artifact?.body?.decidedAt
    ?? artifact?.body?.plannedAt
    ?? artifact?.body?.mergedAt
    ?? artifact?.body?.closeoutAt
    ?? artifact?.body?.closedAt
    ?? null;
}

function timestampFromAgentRun(agentRun) {
  return agentRun?.finishedAt ?? agentRun?.startedAt ?? null;
}

function stageFromAgentRun(agentRun) {
  if (agentRun?.role === "execution") return "execution-agent";
  if (agentRun?.role === "review") return "review-agent";
  if (agentRun?.role === "main" && agentRun.runId === "main-agent:initialization") return "main-agent";
  if (agentRun?.role === "main") return "convergence";
  return null;
}

function stageFromTimelineEntry(taskContextPackage, entry) {
  if (entry.agentRunId) {
    return stageFromAgentRun(agentRunById(taskContextPackage, entry.agentRunId));
  }
  return ARTIFACT_STAGE[entry.artifactType] ?? null;
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

function terminalNode(taskContextPackage) {
  const finalStage = taskContextPackage?.artifacts?.taskCloseout?.body?.finalStage;
  if (!["closed", "cancelled"].includes(finalStage)) return null;
  const { label, transition } = stageDefinition(finalStage);
  return {
    stage: finalStage,
    label,
    transition,
    evidence: "taskCloseout",
    timestamp: timestampFromArtifact(taskContextPackage.artifacts.taskCloseout),
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

function correctionNotes(taskContextPackage) {
  const guidance = latestArtifact(taskContextPackage, "humanConvergenceGuidance");
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

  const timelineNodes = coalesceAdjacentImplementationDetails((taskContextPackage.timeline ?? [])
    .map((entry, index) => nodeFromTimelineEntry(taskContextPackage, entry, index))
    .filter(Boolean));
  const terminal = terminalNode(taskContextPackage);
  const baseNodes = [
    initialNode(taskContextPackage),
    ...timelineNodes,
    ...(terminal ? [terminal] : []),
  ];
  const fallback = fallbackCurrentNode(taskContextPackage, baseNodes);
  const nodes = markCurrentNode(
    fallback ? [...baseNodes, fallback] : baseNodes,
    taskContextPackage.currentWorkStage,
  );

  const transitions = nodes.slice(0, -1).map((node, index) => {
    const nextNode = nodes[index + 1];
    return {
      from: node.stage,
      to: nextNode.stage,
      label: node.transition,
      status: "completed",
    };
  });

  return {
    currentStage: taskContextPackage.currentWorkStage,
    nodes,
    transitions,
    notes: correctionNotes(taskContextPackage),
  };
}
