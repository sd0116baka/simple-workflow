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

export function stageDefinition(stage) {
  return STAGE_DEFINITIONS[stage] ?? { label: stage, transition: null };
}

export function stageFromArtifactType(artifactType) {
  return ARTIFACT_STAGE[artifactType] ?? null;
}

export function stageFromAgentRun(agentRun) {
  if (agentRun?.role === "execution") return "execution-agent";
  if (agentRun?.role === "review") return "review-agent";
  if (agentRun?.role === "main" && agentRun.runId === "main-agent:initialization") return "main-agent";
  if (agentRun?.role === "main") return "convergence";
  return null;
}

export function timestampFromArtifact(artifact) {
  return artifact?.appendedAt
    ?? artifact?.body?.requestedAt
    ?? artifact?.body?.decidedAt
    ?? artifact?.body?.plannedAt
    ?? artifact?.body?.mergedAt
    ?? artifact?.body?.closeoutAt
    ?? artifact?.body?.closedAt
    ?? null;
}

export function timestampFromAgentRun(agentRun) {
  return agentRun?.finishedAt ?? agentRun?.startedAt ?? null;
}
