import {
  evaluateStartupCheck,
  runtimeSnapshotFromRepositoryStatus,
} from "./execution-admission.js";
import { listRawTasks } from "./task-source.js";

export function createWorkflowReadModelService({
  tasksDir,
  taskContextWorkspace,
  getRepositoryStatus,
  getLatestRecommendationRun,
  listTasks = listRawTasks,
}) {
  async function listTaskPool() {
    return taskContextWorkspace.buildCurrentTaskPool({
      latestRecommendationRun: getLatestRecommendationRun(),
    });
  }

  async function getStartupCheck() {
    const taskPool = await listTaskPool();
    const activeWork = taskContextWorkspace.findActiveWork(taskPool.taskContextPackages);
    return evaluateStartupCheck({
      runtimeSnapshot: {
        ...runtimeSnapshotFromRepositoryStatus(await getRepositoryStatus()),
        activeWork,
      },
    });
  }

  return {
    listTasks() {
      return listTasks(tasksDir);
    },
    listTaskPool,
    getStartupCheck,
  };
}
