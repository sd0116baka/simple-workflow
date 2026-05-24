import { listRawTasks } from "./task-source.js";

export async function loadRecommendationRunCompletionInput({
  run,
  commandResult,
  tasksDir,
  repositoryDir,
  taskContextWorkspace,
  getStartupCheck,
  getLatestRecommendationRun,
  runMainAgentSession,
  runExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  recommendationRunControllerRegistry,
  onProgress,
  onPackageBound,
  listTasks = listRawTasks,
}) {
  const tasks = await listTasks(tasksDir);
  const startupCheck = await getStartupCheck();
  const latestRecommendationRun = getLatestRecommendationRun();
  const existingTaskContextPackages =
    await taskContextWorkspace.loadExistingTaskContextPackages({
      latestRecommendationRun,
    });
  const signal = recommendationRunControllerRegistry.signalFor(run.id);

  return {
    run,
    stageSwitches: run.stageSwitches,
    commandResult,
    tasks,
    startupCheck,
    projectProfile: {
      defaults: {
        maxIterations: 3,
      },
    },
    existingTaskContextPackages,
    runMainAgentSession,
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    repositoryDir,
    onProgress,
    onPackageBound,
    signal,
  };
}
