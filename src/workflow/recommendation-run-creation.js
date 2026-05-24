import { startRecommendationFlow } from "./recommendation-flow.js";
import { startRecommendationRunCommand } from "./recommendation-run-command-start.js";
import { toRecommendationSnapshot } from "./recommendation-run-snapshot.js";
import { listRawTasks } from "./task-source.js";

export async function createRecommendationRunTransaction({
  mode = "workflow",
  stageSwitches,
  tasksDir,
  recommendationPromptPath,
  taskContextWorkspace,
  getStartupCheck,
  runRecommendationCommand,
  recommendationRunLifecycleState,
  recommendationRunControllerRegistry,
  recommendationRunCompletion,
  emitRecommendationChanged,
  progressRecorder = null,
  listTasks = listRawTasks,
  startFlow = startRecommendationFlow,
  startCommand = startRecommendationRunCommand,
  snapshotRun = toRecommendationSnapshot,
}) {
  if (recommendationRunLifecycleState.hasRunningRun()) {
    return recommendationRunLifecycleState.snapshotLatestRun();
  }

  const latestRecommendationRun = recommendationRunLifecycleState.getLatestRun();
  const startupCheck = await getStartupCheck();
  const { run } = await startFlow({
    id: recommendationRunLifecycleState.nextRunId(),
    mode,
    stageSwitches,
    tasks: await listTasks(tasksDir),
    startupCheck,
    recommendationPromptPath,
    existingTaskContextPackages: await taskContextWorkspace.loadExistingTaskContextPackages({
      latestRecommendationRun,
    }),
  });

  recommendationRunLifecycleState.setLatestRun(run);
  progressRecorder?.recordSystemEvent(run, {
    type: "run_started",
    message: "recommendation run 已创建。",
    mode: run.mode,
    stageSwitches: run.stageSwitches,
  });
  progressRecorder?.recordSystemEvent(run, {
    type: "startup_check_completed",
    message: startupCheck.canStartWork ? "启动检查通过。" : "启动检查未通过。",
    canStartWork: startupCheck.canStartWork,
    error: startupCheck.error ?? null,
    findingCount: startupCheck.findings?.length ?? 0,
    worktreeClean: startupCheck.runtimeSnapshot?.worktree?.clean ?? null,
  });
  emitRecommendationChanged(run);
  if (run.status !== "running") {
    progressRecorder?.recordRunFinished(run);
    return snapshotRun(run);
  }

  return startCommand({
    run,
    runRecommendationCommand,
    recommendationRunControllerRegistry,
    recommendationRunCompletion,
    emitRecommendationChanged,
    progressRecorder,
  });
}
