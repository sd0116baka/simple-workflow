import {
  loadTaskContextPackages,
  saveTaskContextPackage,
} from "./task-context-package-store.js";
import {
  applyAppendRequest,
  buildTaskPool,
  transitionTaskContextPackageStage,
} from "./task-pool.js";
import { listRawTasks } from "./task-source.js";
import {
  findAcceptableTaskContextPackage,
  findActiveWork,
  findAutoMergePlannablePackage,
  findCancellableHumanDecisionPackage,
  findGuidableConvergenceDecisionPackage,
  mergeLatestRunPackage,
} from "./task-context-package-selectors.js";

export function createTaskContextPackageWorkspace({
  tasksDir,
  taskContextPackageStoreDir,
  listTasks = listRawTasks,
}) {
  async function loadExistingTaskContextPackages({ latestRecommendationRun = null } = {}) {
    return mergeLatestRunPackage(
      await loadTaskContextPackages({ storeDir: taskContextPackageStoreDir }),
      latestRecommendationRun,
    );
  }

  async function persistTaskContextPackage(taskContextPackage) {
    if (!taskContextPackage?.packageId) return;
    await saveTaskContextPackage({
      storeDir: taskContextPackageStoreDir,
      taskContextPackage,
    });
  }

  async function buildCurrentTaskPool({ latestRecommendationRun = null } = {}) {
    return buildTaskPool(await listTasks(tasksDir), {
      taskContextPackages: await loadExistingTaskContextPackages({ latestRecommendationRun }),
    });
  }

  async function applyAppendRequestToCurrentPool(
    appendRequest,
    { currentWorkStage, latestRecommendationRun = null } = {},
  ) {
    const taskPool = applyAppendRequest(
      await buildCurrentTaskPool({ latestRecommendationRun }),
      appendRequest,
      { currentWorkStage },
    );
    const taskContextPackage = taskPool.taskContextPackages.find((candidate) =>
      candidate.packageId === appendRequest.packageId,
    ) ?? null;
    if (taskContextPackage) {
      await persistTaskContextPackage(taskContextPackage);
    }
    return { taskPool, taskContextPackage };
  }

  async function transitionCurrentPackageStage(
    packageId,
    { currentWorkStage, latestRecommendationRun = null } = {},
  ) {
    const taskPool = transitionTaskContextPackageStage(
      await buildCurrentTaskPool({ latestRecommendationRun }),
      packageId,
      { currentWorkStage },
    );
    const taskContextPackage = taskPool.taskContextPackages.find((candidate) =>
      candidate.packageId === packageId,
    ) ?? null;
    if (taskContextPackage) {
      await persistTaskContextPackage(taskContextPackage);
    }
    return { taskPool, taskContextPackage };
  }

  async function selectWithCurrentPackages(selector, options = {}) {
    const taskContextPackages = await loadExistingTaskContextPackages({
      latestRecommendationRun: options.latestRecommendationRun,
    });
    return selector({
      ...options,
      taskContextPackages,
    });
  }

  return {
    loadExistingTaskContextPackages,
    persistTaskContextPackage,
    buildCurrentTaskPool,
    applyAppendRequestToCurrentPool,
    transitionCurrentPackageStage,
    findActiveWork,
    findAcceptableTaskContextPackage: (options = {}) =>
      selectWithCurrentPackages(findAcceptableTaskContextPackage, options),
    findAutoMergePlannablePackage: (options = {}) =>
      selectWithCurrentPackages(findAutoMergePlannablePackage, options),
    findGuidableConvergenceDecisionPackage: (options = {}) =>
      selectWithCurrentPackages(findGuidableConvergenceDecisionPackage, options),
    findCancellableHumanDecisionPackage: (options = {}) =>
      selectWithCurrentPackages(findCancellableHumanDecisionPackage, options),
  };
}
