import { createTaskContextPackageFixture } from "./task-context-package-fixtures.js";

export function createAutoMergePackageFixture({
  stage = "auto-merge-planning",
  humanDecision = { decision: "accept-convergence" },
  convergenceSuccess = { summary: "完成" },
  isolatedWorkspace = { worktreePath: ".workflow/worktrees/task-001" },
  autoMergePlan = null,
  taskDraft = { id: "task-001", name: "实现测试任务" },
} = {}) {
  const artifacts = {};
  if (humanDecision) artifacts.humanDecision = { body: humanDecision };
  if (convergenceSuccess) artifacts.convergenceSuccess = { body: convergenceSuccess };
  if (isolatedWorkspace) artifacts.isolatedWorkspace = { body: isolatedWorkspace };
  if (autoMergePlan) artifacts.autoMergePlan = { body: autoMergePlan };
  return createTaskContextPackageFixture({
    currentWorkStage: stage,
    taskDraft,
    artifacts,
  });
}
