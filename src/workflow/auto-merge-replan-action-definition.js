import { hasArtifactBody } from "./task-package-artifacts.js";

export function createAutoMergeReplanActionDefinition({
  repositoryDir,
  findAutoMergePlannablePackage,
  applyAppendRequest,
  replanAutoMergeAction,
} = {}) {
  return function replanAutoMerge({ packageId = null } = {}) {
    return {
      packageId,
      findTaskContextPackage: findAutoMergePlannablePackage,
      isUnavailable: (taskContextPackage) =>
        !taskContextPackage || hasArtifactBody(taskContextPackage, "taskCloseout"),
      unavailableResponse: { planned: false },
      missingPackageMessage: (id) => `没有找到可重新生成合并计划的任务上下文包：${id}`,
      missingDefaultMessage: "没有可重新生成合并计划的任务上下文包。",
      run: ({ recommendationRun }) => replanAutoMergeAction({
        recommendationRun,
        repositoryDir,
        applyAppendRequest,
      }),
    };
  };
}
