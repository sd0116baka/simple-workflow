import { createTaskContextPackageFixture } from "./task-context-package-fixtures.js";

export function humanDecisionArtifact(artifactId, body = {}) {
  return { artifactId, body, appendedAt: "2026-05-21T10:00:00.000Z" };
}

export function createHumanDecisionPackageFixture({
  targetType = "convergenceSuccess",
  requestTargetType = null,
  requestTargetRef = null,
} = {}) {
  const artifacts = {
    convergenceSuccess: humanDecisionArtifact("convergenceSuccess", { summary: "完成" }),
    convergenceFailure: [
      humanDecisionArtifact("convergenceFailure:001", { summary: "旧失败" }),
      humanDecisionArtifact("convergenceFailure:002", { summary: "新失败" }),
    ],
    autoMergeFailure: humanDecisionArtifact("autoMergeFailure", { reasons: [] }),
    isolatedWorkspace: humanDecisionArtifact("isolatedWorkspace", {
      worktreePath: ".workflow/worktrees/tasks/task-001",
      branchName: "workflow/tasks/task-001",
      baseCommit: "base",
    }),
  };

  if (targetType === "convergenceSuccess") {
    artifacts.humanDecisionRequest = humanDecisionArtifact("humanDecisionRequest", {
      convergenceSuccessRef: "convergenceSuccess",
      decisionOptions: ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"],
    });
  } else {
    artifacts.humanDecisionRequest = humanDecisionArtifact("humanDecisionRequest", {
      targetType: requestTargetType ?? targetType,
      targetRef: requestTargetRef ?? targetType,
      decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
    });
  }

  return createTaskContextPackageFixture({
    currentWorkStage: "human-decision",
    artifacts,
  });
}

export function createHumanDecisionConvergenceSuccessPackageFixture() {
  return createTaskContextPackageFixture({
    packageId: "task-context-package:tasks/task-003.yaml",
    currentWorkStage: "human-decision",
    source: { path: "tasks/task-003.yaml" },
    taskDraft: { id: "task-003", name: "人工决策测试任务" },
    artifacts: {
      convergenceSuccess: humanDecisionArtifact("convergenceSuccess", { summary: "完成" }),
      isolatedWorkspace: humanDecisionArtifact("isolatedWorkspace", {
        worktreePath: ".workflow/worktrees/tasks/tasks-task-003",
        branchName: "workflow/tasks/tasks-task-003",
        baseCommit: "base-commit",
      }),
      humanDecisionRequest: humanDecisionArtifact("humanDecisionRequest", {
        convergenceSuccessRef: "convergenceSuccess",
        decisionOptions: ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"],
      }),
    },
  });
}

export function createHumanDecisionConvergenceFailurePackageFixture() {
  return createTaskContextPackageFixture({
    packageId: "task-context-package:tasks/task-003.yaml",
    currentWorkStage: "human-decision",
    source: { path: "tasks/task-003.yaml" },
    taskDraft: { id: "task-003", name: "人工决策测试任务" },
    artifacts: {
      convergenceFailure: [
        humanDecisionArtifact("convergenceFailure:001", { summary: "收敛失败" }),
      ],
      humanDecisionRequest: humanDecisionArtifact("humanDecisionRequest", {
        targetType: "convergenceFailure",
        targetRef: "convergenceFailure:001",
        decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
      }),
    },
  });
}

export function createHumanDecisionAutoMergeIssuePackageFixture({
  artifactType = "autoMergeRejection",
} = {}) {
  return createTaskContextPackageFixture({
    packageId: "task-context-package:tasks/task-003.yaml",
    currentWorkStage: "human-decision",
    source: { path: "tasks/task-003.yaml" },
    taskDraft: { id: "task-003", name: "人工决策测试任务" },
    artifacts: {
      [artifactType]: humanDecisionArtifact(artifactType, { reasons: [] }),
      humanDecisionRequest: humanDecisionArtifact("humanDecisionRequest", {
        targetType: artifactType,
        targetRef: artifactType,
        decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
      }),
    },
  });
}
