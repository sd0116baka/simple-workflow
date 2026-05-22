import { artifactRecord } from "./task-package-artifacts.js";

export function buildAutoMergePlanningViewModel(taskContextPackage) {
  const plan = artifactRecord(taskContextPackage, "autoMergePlan");
  const rejection = artifactRecord(taskContextPackage, "autoMergeRejection");
  const record = plan ?? rejection;
  if (!record?.body) return null;

  return {
    className: `auto-merge-panel ${plan ? "autoMergePlan" : "autoMergeRejection"}`,
    title: plan ? "已生成自动合并计划" : "自动合并前置校验未通过",
    meta: plan
      ? [
          `target: ${record.body.target?.branchName ?? "unknown"}`,
          `changes: ${record.body.changeSet?.changedFiles?.length ?? 0}`,
          `plannedAt: ${record.body.plannedAt ?? record.appendedAt ?? "unknown"}`,
        ].join(" · ")
      : [
          `decisionRef: ${record.body.decisionRef ?? "unknown"}`,
          `rejectedAt: ${record.body.rejectedAt ?? record.appendedAt ?? "unknown"}`,
        ].join(" · "),
    listItems: plan
      ? record.body.changeSet?.changedFiles ?? []
      : (record.body.reasons ?? []).map((itemReason) => `${itemReason.code}: ${itemReason.message}`),
  };
}

export function buildAutoMergeExecutionViewModel(taskContextPackage) {
  const result = artifactRecord(taskContextPackage, "autoMergeResult");
  const failure = artifactRecord(taskContextPackage, "autoMergeFailure");
  const record = result ?? failure;
  if (!record?.body) return null;

  return {
    className: `auto-merge-panel ${result ? "autoMergeResult" : "autoMergeFailure"}`,
    title: result ? "已合入目标分支" : "自动合并执行失败",
    meta: result
      ? [
          `target: ${record.body.target?.branchName ?? "unknown"}`,
          `after: ${record.body.target?.afterCommit?.slice(0, 7) ?? "unknown"}`,
          `mergedAt: ${record.body.mergedAt ?? record.appendedAt ?? "unknown"}`,
        ].join(" · ")
      : [
          `planRef: ${record.body.planRef ?? "unknown"}`,
          `failedAt: ${record.body.failedAt ?? record.appendedAt ?? "unknown"}`,
        ].join(" · "),
    listItems: result
      ? record.body.changeSet?.changedFiles ?? []
      : (record.body.reasons ?? []).map((itemReason) => `${itemReason.code}: ${itemReason.message}`),
  };
}

export function buildTaskCloseoutViewModel(taskContextPackage) {
  const closeout = artifactRecord(taskContextPackage, "taskCloseout");
  if (!closeout?.body) return null;

  const cleanup = closeout.body.cleanup ?? {};
  return {
    className: "auto-merge-panel taskCloseout",
    title: closeout.body.finalStage === "cancelled"
      ? "任务已取消并收尾"
      : "任务已关闭并收尾",
    meta: [
      `finalStage: ${closeout.body.finalStage ?? "unknown"}`,
      `reason: ${closeout.body.closeoutReason ?? "merged"}`,
      `closeoutAt: ${closeout.body.closeoutAt ?? closeout.body.closedAt ?? closeout.appendedAt ?? "unknown"}`,
    ].join(" · "),
    listItems: [
      `worktree: ${cleanup.worktree?.path ?? "unknown"} · removed: ${String(cleanup.worktree?.removed ?? false)}`,
      `branch: ${cleanup.branch?.name ?? "unknown"} · deleted: ${String(cleanup.branch?.deleted ?? false)}`,
    ],
  };
}
