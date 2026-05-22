import {
  artifactBody,
  allArtifactRecords,
  hasArtifactBody,
} from "./task-package-artifacts.js";

export function buildTaskContextPackageViewModel(taskContextPackage) {
  const taskCloseoutBody = artifactBody(taskContextPackage, "taskCloseout");
  return {
    className: `context-package ${taskContextPackage.currentWorkStage}`,
    title: taskContextPackage.packageId,
    meta: [
      `currentWorkStage: ${taskContextPackage.currentWorkStage}`,
      `source: ${taskContextPackage.source?.path ?? "unknown"}`,
    ].join(" · "),
    artifactStatuses: [
      {
        label: "基础包",
        value: taskContextPackage.qualityGate?.outcome ?? "missing",
      },
      {
        label: "执行意图",
        value: hasArtifactBody(taskContextPackage, "executionIntent") ? "已追加" : "未追加",
      },
      {
        label: "执行授权",
        value: hasArtifactBody(taskContextPackage, "executionAuthorization")
          ? "已追加"
          : hasArtifactBody(taskContextPackage, "admissionRejection")
            ? "未授权"
            : "未追加",
      },
      {
        label: "隔离工作树",
        value: hasArtifactBody(taskContextPackage, "isolatedWorkspace") ? "已分配" : "未分配",
      },
      {
        label: "收敛成功证据",
        value: hasArtifactBody(taskContextPackage, "convergenceSuccess") ? "待确认" : "未生成",
      },
      {
        label: "人工决策",
        value: hasArtifactBody(taskContextPackage, "humanDecision")
          ? "已接受收敛成功"
          : hasArtifactBody(taskContextPackage, "humanDecisionRequest")
            ? "等待人工决策"
            : "未请求",
      },
      {
        label: "自动合并计划",
        value: hasArtifactBody(taskContextPackage, "autoMergePlan")
          ? "已生成"
          : hasArtifactBody(taskContextPackage, "autoMergeRejection")
            ? "未通过"
            : "未检查",
      },
      {
        label: "自动合并执行",
        value: hasArtifactBody(taskContextPackage, "autoMergeResult")
          ? "已合并"
          : hasArtifactBody(taskContextPackage, "autoMergeFailure")
            ? "失败"
            : "未执行",
      },
      {
        label: "任务收尾",
        value: taskCloseoutBody
          ? taskCloseoutBody.finalStage === "cancelled"
            ? "已取消"
            : "已关闭"
          : "未收尾",
      },
    ],
    artifactRecords: allArtifactRecords(taskContextPackage)
      .map(({ artifactType, artifact }) => {
        const body = artifact.body ?? {};
        return {
          id: artifact.artifactId ?? artifactType,
          timestamp: body.authorizedAt
            ?? body.rejectedAt
            ?? body.requestedAt
            ?? artifact.appendedAt
            ?? "已追加",
          summary: body.reason ?? body.executionBrief?.goalInterpretation ?? body.summary ?? "",
        };
      }),
    agentRuns: (taskContextPackage.agentRuns ?? []).map((agentRun) => ({
      id: agentRun.runId,
      meta: `${agentRun.role} · ${agentRun.status}`,
      sessionId: agentRun.sessionId,
    })),
  };
}
