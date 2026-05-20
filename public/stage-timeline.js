const STAGE_DEFINITIONS = [
  { stage: "task-pool", label: "任务池", transition: "任务入池" },
  { stage: "task-recommender", label: "任务推荐器", transition: "选中候选任务" },
  { stage: "execution-admission", label: "执行准入器", transition: "授权或拒绝" },
  { stage: "isolated-workspace", label: "隔离工作树", transition: "分配执行环境" },
  { stage: "main-agent", label: "Main Agent", transition: "初始化会话" },
  { stage: "execution-agent", label: "Execution Agent", transition: "执行任务" },
  { stage: "review-agent", label: "Review Agent", transition: "审查执行结果" },
  { stage: "convergence", label: "收敛判断", transition: "判断下一步" },
  { stage: "human-decision", label: "人工决策", transition: "人工选择" },
  { stage: "auto-merge-planning", label: "合并前置校验", transition: "生成合并计划" },
  { stage: "auto-merge-execution", label: "自动合并执行", transition: "执行合并" },
  { stage: "merged", label: "已合入", transition: "进入收尾" },
  { stage: "task-closeout", label: "任务收尾", transition: "清理执行资源" },
  { stage: "closed", label: "已关闭", transition: null },
  { stage: "cancelled", label: "已取消", transition: null },
];

function artifactRecords(artifactValue) {
  if (Array.isArray(artifactValue)) return artifactValue;
  return artifactValue ? [artifactValue] : [];
}

function latestArtifact(taskContextPackage, artifactType) {
  const records = artifactRecords(taskContextPackage?.artifacts?.[artifactType]);
  return records.length > 0 ? records[records.length - 1] : null;
}

function hasArtifact(taskContextPackage, artifactType) {
  return artifactRecords(taskContextPackage?.artifacts?.[artifactType]).length > 0;
}

function agentRun(taskContextPackage, predicate) {
  return (taskContextPackage?.agentRuns ?? []).find(predicate) ?? null;
}

function latestAgentRun(taskContextPackage, predicate) {
  return [...(taskContextPackage?.agentRuns ?? [])].reverse().find(predicate) ?? null;
}

function latestArtifactId(taskContextPackage, artifactType) {
  return latestArtifact(taskContextPackage, artifactType)?.artifactId ?? null;
}

function latestArtifactTimestamp(taskContextPackage, artifactType) {
  const artifact = latestArtifact(taskContextPackage, artifactType);
  return artifact?.appendedAt
    ?? artifact?.body?.appendedAt
    ?? artifact?.body?.requestedAt
    ?? artifact?.body?.decidedAt
    ?? artifact?.body?.plannedAt
    ?? artifact?.body?.mergedAt
    ?? artifact?.body?.closeoutAt
    ?? artifact?.body?.closedAt
    ?? null;
}

function agentRunTimestamp(run) {
  return run?.finishedAt ?? run?.startedAt ?? null;
}

function latestTimelineTimestamp(taskContextPackage, predicate) {
  const entry = [...(taskContextPackage?.timeline ?? [])].reverse().find(predicate);
  return entry?.appendedAt ?? null;
}

function humanDecisionLabel(taskContextPackage) {
  const guidance = latestArtifact(taskContextPackage, "humanConvergenceGuidance");
  if (guidance) return guidance.artifactId ?? "humanConvergenceGuidance";
  const decision = latestArtifact(taskContextPackage, "humanDecision");
  if (decision) return decision.body?.decision ?? decision.artifactId ?? "humanDecision";
  const request = latestArtifact(taskContextPackage, "humanDecisionRequest");
  return request?.artifactId ?? null;
}

function stageEvidence(taskContextPackage, stage) {
  const artifacts = taskContextPackage?.artifacts ?? {};
  switch (stage) {
    case "task-pool":
      return taskContextPackage ? taskContextPackage.packageId ?? "taskContextPackage" : null;
    case "task-recommender":
      return latestArtifactId(taskContextPackage, "executionIntent");
    case "execution-admission":
      return latestArtifactId(taskContextPackage, "executionAuthorization")
        ?? latestArtifactId(taskContextPackage, "admissionRejection");
    case "isolated-workspace":
      return latestArtifactId(taskContextPackage, "isolatedWorkspace");
    case "main-agent": {
      const run = agentRun(taskContextPackage, (item) =>
        item.role === "main" && item.runId === "main-agent:initialization",
      );
      return run?.runId ?? null;
    }
    case "execution-agent":
      return latestArtifactId(taskContextPackage, "executionReport")
        ?? latestAgentRun(taskContextPackage, (item) => item.role === "execution")?.runId
        ?? null;
    case "review-agent":
      return latestArtifactId(taskContextPackage, "reviewReport")
        ?? latestAgentRun(taskContextPackage, (item) => item.role === "review")?.runId
        ?? null;
    case "convergence":
      return latestArtifactId(taskContextPackage, "convergenceAdvice")
        ?? latestArtifactId(taskContextPackage, "convergenceSuccess")
        ?? latestArtifactId(taskContextPackage, "convergenceFailure")
        ?? latestAgentRun(taskContextPackage, (item) => item.runId?.startsWith("main-agent:convergence"))?.runId
        ?? null;
    case "human-decision":
      return humanDecisionLabel(taskContextPackage);
    case "auto-merge-planning":
      return latestArtifactId(taskContextPackage, "autoMergePlan")
        ?? latestArtifactId(taskContextPackage, "autoMergeRejection")
        ?? (artifacts.humanDecision?.body?.nextRequiredStage === "auto-merge-planning" ? "humanDecision" : null);
    case "auto-merge-execution":
      return latestArtifactId(taskContextPackage, "autoMergeResult")
        ?? latestArtifactId(taskContextPackage, "autoMergeFailure");
    case "merged":
      return latestArtifactId(taskContextPackage, "autoMergeResult");
    case "task-closeout":
      return latestArtifactId(taskContextPackage, "taskCloseout");
    case "closed":
      return artifacts.taskCloseout?.body?.finalStage === "closed" ? "taskCloseout" : null;
    case "cancelled":
      return artifacts.taskCloseout?.body?.finalStage === "cancelled" ? "taskCloseout" : null;
    default:
      return null;
  }
}

function stageTimestamp(taskContextPackage, stage) {
  switch (stage) {
    case "task-pool":
      return taskContextPackage?.fixture?.generatedAt
        ?? latestTimelineTimestamp(taskContextPackage, () => true);
    case "task-recommender":
      return latestArtifactTimestamp(taskContextPackage, "executionIntent");
    case "execution-admission":
      return latestArtifactTimestamp(taskContextPackage, "executionAuthorization")
        ?? latestArtifactTimestamp(taskContextPackage, "admissionRejection");
    case "isolated-workspace":
      return latestArtifactTimestamp(taskContextPackage, "isolatedWorkspace");
    case "main-agent":
      return agentRunTimestamp(agentRun(taskContextPackage, (item) =>
        item.role === "main" && item.runId === "main-agent:initialization",
      ));
    case "execution-agent":
      return agentRunTimestamp(latestAgentRun(taskContextPackage, (item) => item.role === "execution"))
        ?? latestArtifactTimestamp(taskContextPackage, "executionReport")
        ?? latestArtifactTimestamp(taskContextPackage, "humanConvergenceGuidance");
    case "review-agent":
      return agentRunTimestamp(latestAgentRun(taskContextPackage, (item) => item.role === "review"))
        ?? latestArtifactTimestamp(taskContextPackage, "reviewReport");
    case "convergence":
      return agentRunTimestamp(latestAgentRun(taskContextPackage, (item) =>
        item.runId?.startsWith("main-agent:convergence"),
      ))
        ?? latestArtifactTimestamp(taskContextPackage, "convergenceAdvice")
        ?? latestArtifactTimestamp(taskContextPackage, "convergenceSuccess")
        ?? latestArtifactTimestamp(taskContextPackage, "convergenceFailure");
    case "human-decision":
      return latestArtifactTimestamp(taskContextPackage, "humanConvergenceGuidance")
        ?? latestArtifactTimestamp(taskContextPackage, "humanDecision")
        ?? latestArtifactTimestamp(taskContextPackage, "humanDecisionRequest");
    case "auto-merge-planning":
      return latestArtifactTimestamp(taskContextPackage, "autoMergePlan")
        ?? latestArtifactTimestamp(taskContextPackage, "autoMergeRejection")
        ?? latestArtifactTimestamp(taskContextPackage, "humanDecision");
    case "auto-merge-execution":
      return latestArtifactTimestamp(taskContextPackage, "autoMergeResult")
        ?? latestArtifactTimestamp(taskContextPackage, "autoMergeFailure");
    case "merged":
      return latestArtifactTimestamp(taskContextPackage, "autoMergeResult");
    case "task-closeout":
    case "closed":
    case "cancelled":
      return latestArtifactTimestamp(taskContextPackage, "taskCloseout");
    default:
      return null;
  }
}

function skippedStage(taskContextPackage, stage) {
  const decision = taskContextPackage?.artifacts?.humanDecision?.body?.decision;
  const finalStage = taskContextPackage?.artifacts?.taskCloseout?.body?.finalStage;
  if (finalStage === "closed" && stage === "cancelled") return true;
  if (finalStage === "cancelled" && stage === "closed") return true;
  if (decision === "cancel-task") {
    return [
      "auto-merge-planning",
      "auto-merge-execution",
      "merged",
      "closed",
    ].includes(stage);
  }
  return false;
}

function stageDetail({ taskContextPackage, stage, status, evidence }) {
  if (status === "current") return evidence ? `当前 · ${evidence}` : "当前环节";
  if (status === "skipped") return "未进入此分支";
  if (evidence) return evidence;
  if (!taskContextPackage) return "等待任务包";
  return "等待";
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
  const currentStage = taskContextPackage?.currentWorkStage ?? null;
  const nodes = STAGE_DEFINITIONS.map((definition) => {
    const evidence = stageEvidence(taskContextPackage, definition.stage);
    const status = currentStage === definition.stage
      ? "current"
      : evidence
        ? "completed"
      : skippedStage(taskContextPackage, definition.stage)
        ? "skipped"
      : "pending";
    return {
      ...definition,
      evidence,
      timestamp: stageTimestamp(taskContextPackage, definition.stage),
      status,
      detail: stageDetail({
        taskContextPackage,
        stage: definition.stage,
        status,
        evidence,
      }),
    };
  });

  const transitions = nodes.slice(0, -1).map((node, index) => {
    const nextNode = nodes[index + 1];
    const completed = ["completed", "current"].includes(node.status)
      && ["completed", "current"].includes(nextNode.status);
    return {
      from: node.stage,
      to: nextNode.stage,
      label: node.transition,
      status: completed ? "completed" : "pending",
    };
  });

  return {
    currentStage,
    nodes,
    transitions,
    notes: correctionNotes(taskContextPackage),
  };
}
