const RUNNING_STAGE_BY_PROGRESS_PREFIX = Object.freeze({
  execution_: "execution-agent",
  review_: "review-agent",
});

function packageIdFromRun(recommendationRun) {
  return recommendationRun?.executionIntentAppendRequest?.packageId
    ?? recommendationRun?.executionIntent?.recommendedPackageId
    ?? null;
}

function sourcePathFromPackageId(packageId) {
  const match = /^task-context-package:(.+)$/.exec(packageId ?? "");
  return match?.[1] ?? null;
}

function stageFromMainProgress(entry) {
  const text = `${entry?.message ?? ""}\n${entry?.terminalLine ?? ""}`;
  if (text.includes("main-agent:initialization")) return "main-agent";
  if (text.includes("main-agent:convergence")) return "convergence";
  return "main-agent";
}

function stageFromProgress(entry) {
  const type = entry?.type ?? "";
  if (type.startsWith("main_")) return stageFromMainProgress(entry);
  const match = Object.entries(RUNNING_STAGE_BY_PROGRESS_PREFIX)
    .find(([prefix]) => type.startsWith(prefix));
  return match?.[1] ?? null;
}

export function runningTaskContextPackageFromRecommendationRun(recommendationRun) {
  if (recommendationRun?.status !== "running") return null;
  const runningProgress = [...(recommendationRun.progress ?? [])].reverse()
    .find((entry) => stageFromProgress(entry));
  const currentWorkStage = stageFromProgress(runningProgress);
  if (!currentWorkStage) return null;

  const packageId = packageIdFromRun(recommendationRun);
  if (!packageId) return null;
  const sourcePath = sourcePathFromPackageId(packageId);
  return {
    packageId,
    currentWorkStage,
    source: {
      path: sourcePath,
      format: "yaml",
      contentHash: "running",
    },
    recognition: { outcome: "recognized", findings: [] },
    taskDraft: recommendationRun.taskContextPackage?.taskDraft ?? null,
    qualityGate: { outcome: "pass" },
    artifacts: recommendationRun.taskContextPackage?.artifacts ?? {},
    agentRuns: recommendationRun.taskContextPackage?.agentRuns ?? [],
    timeline: recommendationRun.taskContextPackage?.timeline ?? [],
    runtime: {
      status: "running",
      progressType: runningProgress.type,
      progressMessage: runningProgress.message,
    },
  };
}
