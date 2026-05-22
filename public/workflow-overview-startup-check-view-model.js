export function buildStartupCheckViewModel(startupCheck = null) {
  const worktree = startupCheck?.runtimeSnapshot?.worktree ?? { clean: false, changedFiles: [] };
  const changedFiles = worktree.changedFiles ?? [];
  const viewModel = {
    rawText: JSON.stringify(startupCheck, null, 2),
    inputs: [
      { label: "输入", value: "当前运行环境快照" },
      { label: "activeWork", value: startupCheck?.runtimeSnapshot?.activeWork ? "存在" : "无" },
      { label: "git", value: startupCheck?.runtimeSnapshot?.worktree?.clean ? "clean" : "dirty/unknown" },
    ],
    statusText: startupCheck?.canStartWork ? "可启动" : "不可启动",
    emptyText: null,
    summary: null,
    metrics: [],
    findings: [],
    changedFiles: [],
  };

  if (!startupCheck) {
    return {
      ...viewModel,
      statusText: "未载入",
      emptyText: "未返回启动检查。",
    };
  }

  return {
    ...viewModel,
    summary: {
      className: `startup-check-summary ${startupCheck.canStartWork ? "pass" : "fail"}`,
      text: startupCheck.canStartWork ? "当前可以启动新任务。" : "当前不能启动新任务。",
    },
    metrics: [
      { label: "canStartWork", value: String(startupCheck.canStartWork) },
      { label: "git", value: worktree.clean ? "clean" : "dirty" },
      { label: "git changes", value: String(changedFiles.length) },
    ],
    findings: (startupCheck.findings ?? []).map((finding) =>
      `${finding.code}: ${finding.message}`,
    ),
    changedFiles: changedFiles.slice(0, 6),
  };
}
