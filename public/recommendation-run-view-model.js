import {
  formatElapsed,
  formatProgress,
  stripAnsi,
} from "./workflow-formatters.js";

export function buildRecommendationRaw(run) {
  if (!run) return "尚未触发推荐器。";
  const chunks = [];
  if (run.progress?.length > 0) {
    chunks.push(`运行进度\n${formatProgress(run.progress)}`);
  }
  if (run.stdout) chunks.push(`结构化产物(stdout)\n${stripAnsi(run.stdout)}`);
  if (run.stderr) chunks.push(`运行日志(stderr)\n${stripAnsi(run.stderr)}`);
  if (run.error) chunks.push(`错误(error)\n${stripAnsi(run.error)}`);
  return chunks.join("\n\n") || "等待输出...";
}

export function buildRecommendationRunViewModel({
  recommendationRun,
  poolEntryCount,
  startupCheck,
  now,
} = {}) {
  const rawText = buildRecommendationRaw(recommendationRun);
  const recommendationInputs = [
    { label: "prompt", value: "project_profiles/recommender-agent.prompt.md" },
    { label: "命令", value: "opencode run --format json" },
    { label: "工作目录", value: "仓库根目录" },
    { label: "读取范围", value: "启动检查通过后注入的 candidateTasks" },
  ];
  const admissionInputs = [
    {
      label: "执行意图",
      value: recommendationRun?.executionIntent
        ? recommendationRun.executionIntent.recommendedPackageId
        : "未生成",
    },
    { label: "任务池", value: `${poolEntryCount ?? 0} 个条目` },
    { label: "启动检查", value: startupCheck ? String(startupCheck.canStartWork) : "未载入" },
  ];
  const controls = {
    runDisabled: recommendationRun?.status === "running",
    cancelHidden: recommendationRun?.status !== "running",
    cancelDisabled: false,
    cancelText: "取消运行",
  };

  if (!recommendationRun) {
    return {
      hasRun: false,
      rawText,
      recommendationInputs,
      admissionInputs,
      controls,
      recommendationStatus: "未运行",
      admissionStatus: "等待输入",
      recommendationResultText: "尚未触发推荐器。",
      recommendationIntentText: "尚未解析。",
      admissionPanelText: "等待推荐器输出。",
    };
  }

  const elapsed = (finishedAt = recommendationRun.finishedAt) =>
    formatElapsed(recommendationRun.startedAt, finishedAt, now);
  const statusText = recommendationRun.status === "running"
    ? `${recommendationRun.status} · ${elapsed(null)}`
    : `${recommendationRun.status} · 用时 ${elapsed(recommendationRun.finishedAt)}`;
  const summaryText = recommendationRun.status === "running"
    ? `探针正在运行... ${elapsed(null)}`
    : recommendationRun.status === "blocked"
      ? "启动检查未通过，推荐器未运行。"
    : recommendationRun.status === "cancelled"
      ? `用户已取消 · 用时 ${elapsed(recommendationRun.finishedAt)}`
    : `exitCode: ${String(recommendationRun.exitCode)} · 用时 ${elapsed(recommendationRun.finishedAt)}`;

  return {
    hasRun: true,
    rawText,
    recommendationInputs,
    admissionInputs,
    controls,
    recommendationStatus: statusText,
    summary: {
      className: `recommendation-summary ${recommendationRun.status}`,
      text: summaryText,
    },
    metaText: recommendationRun.command
      ? `${recommendationRun.command} ${recommendationRun.args?.join(" ") ?? ""}`
      : "未启动外部命令",
    recommendationIntentText: recommendationRun.executionIntentError
      ? `解析失败：${recommendationRun.executionIntentError}`
      : "尚未解析出执行意图。",
    admissionStatus: recommendationRun.executionAdmission
      ? recommendationRun.executionAdmission.appendRequest?.artifactType ?? "未知"
      : "等待输入",
    admissionPanelText: recommendationRun.executionAdmission ? null : "尚未计算执行授权。",
    outputText: [
      recommendationRun.executionIntentError
        ? `解析失败\n${recommendationRun.executionIntentError}`
        : null,
      rawText,
    ].filter(Boolean).join("\n\n") || "等待输出...",
  };
}
