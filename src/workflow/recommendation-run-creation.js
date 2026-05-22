import { startRecommendationFlow } from "./recommendation-flow.js";
import { startRecommendationRunCommand } from "./recommendation-run-command-start.js";
import { toRecommendationSnapshot } from "./recommendation-run-snapshot.js";
import { listRawTasks } from "./task-source.js";

export async function createRecommendationRunTransaction({
  tasksDir,
  recommendationPromptPath,
  taskContextWorkspace,
  getStartupCheck,
  runRecommendationCommand,
  recommendationRunLifecycleState,
  recommendationRunControllerRegistry,
  recommendationRunCompletion,
  emitRecommendationChanged,
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
    tasks: await listTasks(tasksDir),
    startupCheck,
    recommendationPromptPath,
    existingTaskContextPackages: await taskContextWorkspace.loadExistingTaskContextPackages({
      latestRecommendationRun,
    }),
  });

  recommendationRunLifecycleState.setLatestRun(run);
  emitRecommendationChanged(run);
  if (run.status !== "running") {
    return snapshotRun(run);
  }

  return startCommand({
    run,
    runRecommendationCommand,
    recommendationRunControllerRegistry,
    recommendationRunCompletion,
    emitRecommendationChanged,
  });
}
