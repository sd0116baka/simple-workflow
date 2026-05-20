import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acceptConvergenceSuccess,
  cancelTaskAfterHumanDecisionRequest,
  provideHumanConvergenceGuidance,
  requestHumanDecisionForAutoMergeIssue,
  requestHumanDecisionForConvergenceFailure,
  requestHumanDecisionForConvergenceSuccess,
} from "../src/workflow/human-decision-flow.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createGitRepositoryWithWorktree(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-human-decision-"));
  t.after(() => rm(repositoryDir, { recursive: true, force: true }));

  runGit(["init", "-b", "main"], repositoryDir);
  await writeFile(join(repositoryDir, "README.md"), "test repository\n");
  runGit(["add", "README.md"], repositoryDir);
  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "initial commit",
  ], repositoryDir);
  runGit([
    "worktree",
    "add",
    "-b",
    "workflow/tasks/tasks-task-003",
    ".workflow/worktrees/tasks/tasks-task-003",
    "main",
  ], repositoryDir);
  await writeFile(
    join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003", "result.txt"),
    "accepted work\n",
  );

  return repositoryDir;
}

function completedPackage() {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    currentWorkStage: "human-decision",
    artifacts: {
      isolatedWorkspace: {
        artifactId: "isolatedWorkspace",
        body: {
          worktreePath: ".workflow/worktrees/tasks/tasks-task-003",
          branchName: "workflow/tasks/tasks-task-003",
          baseBranch: "main",
          baseCommit: "base-commit",
          status: "ready",
        },
        appendedAt: "2026-05-18T10:00:04.000Z",
      },
      convergenceSuccess: {
        artifactId: "convergenceSuccess",
        body: {
          summary: "stub task completed",
        },
        appendedAt: "2026-05-18T10:00:06.000Z",
      },
      humanDecisionRequest: {
        artifactId: "humanDecisionRequest",
        body: {
          requestedAt: "2026-05-18T10:00:07.000Z",
          convergenceSuccessRef: "convergenceSuccess",
          decisionOptions: ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"],
        },
        appendedAt: "2026-05-18T10:00:07.000Z",
      },
    },
  };
}

function convergenceFailedPackage() {
  const taskPackage = completedPackage();
  delete taskPackage.artifacts.convergenceSuccess;
  taskPackage.artifacts.convergenceFailure = [
    {
      artifactId: "convergenceFailure:001",
      body: {
        summary: "无法自动收敛",
        reasonCode: "max-iterations-reached",
        basisRefs: ["executionReport:001", "reviewReport:001"],
      },
      appendedAt: "2026-05-18T10:00:06.000Z",
    },
  ];
  taskPackage.artifacts.humanDecisionRequest = {
    artifactId: "humanDecisionRequest",
    body: {
      requestedAt: "2026-05-18T10:00:07.000Z",
      targetRef: "convergenceFailure:001",
      decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
    },
    appendedAt: "2026-05-18T10:00:07.000Z",
  };
  return taskPackage;
}

function autoMergeIssuePackage(artifactType = "autoMergeRejection") {
  const taskPackage = completedPackage();
  delete taskPackage.artifacts.convergenceSuccess;
  taskPackage.currentWorkStage = "human-decision";
  taskPackage.artifacts[artifactType] = {
    artifactId: artifactType,
    body: {
      [artifactType === "autoMergeRejection" ? "rejectedAt" : "failedAt"]: "2026-05-18T10:00:06.000Z",
      reasons: [
        {
          code: artifactType === "autoMergeRejection" ? "NO_CHANGES" : "TARGET_MOVED",
          message: "自动合并无法继续。",
        },
      ],
    },
    appendedAt: "2026-05-18T10:00:06.000Z",
  };
  taskPackage.artifacts.humanDecisionRequest = {
    artifactId: "humanDecisionRequest",
    body: {
      requestedAt: "2026-05-18T10:00:07.000Z",
      targetType: artifactType,
      targetRef: artifactType,
      decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
    },
    appendedAt: "2026-05-18T10:00:07.000Z",
  };
  return taskPackage;
}

test("requests human decision after convergence success", () => {
  const result = requestHumanDecisionForConvergenceSuccess({
    taskContextPackage: completedPackage(),
    now: () => "2026-05-18T10:00:07.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(result.appendRequest.artifact.requestedAt, "2026-05-18T10:00:07.000Z");
  assert.equal(result.appendRequest.artifact.convergenceSuccessRef, "convergenceSuccess");
  assert.deepEqual(result.appendRequest.artifact.decisionOptions, [
    "accept-convergence",
    "continue-convergence-with-guidance",
    "cancel-task",
  ]);
});

test("accepts convergence success and prepares auto-merge input", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);

  const result = acceptConvergenceSuccess({
    taskContextPackage: completedPackage(),
    repositoryDir,
    now: () => "2026-05-18T10:00:08.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "humanDecision");
  assert.equal(result.appendRequest.artifact.decision, "accept-convergence");
  assert.equal(result.appendRequest.artifact.decidedAt, "2026-05-18T10:00:08.000Z");
  assert.equal(result.appendRequest.artifact.convergenceSuccessRef, "convergenceSuccess");
  assert.deepEqual(result.appendRequest.artifact.acceptedWork, {
    isolatedWorkspaceRef: "isolatedWorkspace",
    worktreePath: ".workflow/worktrees/tasks/tasks-task-003",
    branchName: "workflow/tasks/tasks-task-003",
    baseCommit: "base-commit",
  });
  assert.deepEqual(result.appendRequest.artifact.worktreeSnapshot, {
    cwd: ".workflow/worktrees/tasks/tasks-task-003",
    changedFiles: ["result.txt"],
  });
  assert.equal(result.appendRequest.artifact.nextRequiredStage, "auto-merge-planning");
});

test("does not accept convergence success outside human-decision stage", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const taskPackage = completedPackage();
  taskPackage.currentWorkStage = "convergence";

  const result = acceptConvergenceSuccess({
    taskContextPackage: taskPackage,
    repositoryDir,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /human-decision/);
});

test("does not throw when accepting convergence success without a worktree", async (t) => {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-missing-worktree-"));
  t.after(() => rm(repositoryDir, { recursive: true, force: true }));
  const taskPackage = completedPackage();

  const result = acceptConvergenceSuccess({
    taskContextPackage: taskPackage,
    repositoryDir,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /无法读取隔离工作树变更/);
});

test("does not request human decision before convergence success exists", () => {
  const taskPackage = completedPackage();
  delete taskPackage.artifacts.convergenceSuccess;

  const result = requestHumanDecisionForConvergenceSuccess({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 convergenceSuccess/);
});

test("requests human decision after convergence failure", () => {
  const result = requestHumanDecisionForConvergenceFailure({
    taskContextPackage: convergenceFailedPackage(),
    now: () => "2026-05-18T10:00:07.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(result.appendRequest.artifact.targetRef, "convergenceFailure:001");
  assert.deepEqual(result.appendRequest.artifact.decisionOptions, [
    "continue-convergence-with-guidance",
    "cancel-task",
  ]);
});

test("requests human decision after auto-merge rejection", () => {
  const result = requestHumanDecisionForAutoMergeIssue({
    taskContextPackage: autoMergeIssuePackage("autoMergeRejection"),
    artifactType: "autoMergeRejection",
    now: () => "2026-05-18T10:00:07.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(result.appendRequest.artifact.targetType, "autoMergeRejection");
  assert.equal(result.appendRequest.artifact.targetRef, "autoMergeRejection");
  assert.deepEqual(result.appendRequest.artifact.decisionOptions, [
    "continue-convergence-with-guidance",
    "cancel-task",
  ]);
});

test("adds human convergence guidance against current failure", () => {
  const result = provideHumanConvergenceGuidance({
    taskContextPackage: convergenceFailedPackage(),
    guidance: "下一轮先收窄状态泄漏，再验证 candidateTasks。",
    focusAreas: ["candidateTasks"],
    avoidRepeating: "不要继续只改 UI 标签",
    expectedNextOutcome: "证明 human-decision 任务不再进入候选集。",
    now: () => "2026-05-18T10:00:08.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "humanConvergenceGuidance");
  assert.equal(result.appendRequest.artifact.decision, "continue-convergence-with-guidance");
  assert.equal(result.appendRequest.artifact.targetType, "convergenceFailure");
  assert.equal(result.appendRequest.artifact.targetRef, "convergenceFailure:001");
  assert.equal(result.appendRequest.artifact.guidance, "下一轮先收窄状态泄漏，再验证 candidateTasks。");
  assert.deepEqual(result.appendRequest.artifact.focusAreas, ["candidateTasks"]);
  assert.deepEqual(result.appendRequest.artifact.avoidRepeating, ["不要继续只改 UI 标签"]);
  assert.equal(result.appendRequest.artifact.expectedNextOutcome, "证明 human-decision 任务不再进入候选集。");
});

test("adds human convergence guidance against auto-merge failure", () => {
  const result = provideHumanConvergenceGuidance({
    taskContextPackage: autoMergeIssuePackage("autoMergeFailure"),
    guidance: "目标分支已移动，先重新整理收敛结果再继续。",
    now: () => "2026-05-18T10:00:08.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "humanConvergenceGuidance");
  assert.equal(result.appendRequest.artifact.targetType, "autoMergeFailure");
  assert.equal(result.appendRequest.artifact.targetRef, "autoMergeFailure");
  assert.equal(result.appendRequest.artifact.nextRequiredStage, "convergence");
});

test("adds human convergence guidance against current success", () => {
  const result = provideHumanConvergenceGuidance({
    taskContextPackage: completedPackage(),
    guidance: "Agent 认为收敛了，但还需要补充边界验证。",
    expectedNextOutcome: "下一轮补齐取消路径证据。",
    now: () => "2026-05-18T10:00:08.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "humanConvergenceGuidance");
  assert.equal(result.appendRequest.artifact.decision, "continue-convergence-with-guidance");
  assert.equal(result.appendRequest.artifact.targetType, "convergenceSuccess");
  assert.equal(result.appendRequest.artifact.targetRef, "convergenceSuccess");
  assert.equal(result.appendRequest.artifact.nextRequiredStage, "convergence");
});

test("uses the current human decision request when success and failure both exist", () => {
  const taskPackage = completedPackage();
  taskPackage.artifacts.convergenceFailure = [
    {
      artifactId: "convergenceFailure:001",
      body: {
        summary: "previous failure",
      },
      appendedAt: "2026-05-18T09:00:00.000Z",
    },
  ];

  const result = provideHumanConvergenceGuidance({
    taskContextPackage: taskPackage,
    guidance: "这次是不同意 convergenceSuccess，而不是继续处理旧失败。",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifact.targetType, "convergenceSuccess");
  assert.equal(result.appendRequest.artifact.targetRef, "convergenceSuccess");
});

test("records cancellation decision before closeout cleans resources", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const taskPackage = convergenceFailedPackage();

  const result = cancelTaskAfterHumanDecisionRequest({
    taskContextPackage: taskPackage,
    repositoryDir,
    now: () => "2026-05-18T10:00:09.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "humanDecision");
  assert.equal(result.appendRequest.artifact.decision, "cancel-task");
  assert.equal(result.appendRequest.artifact.targetRef, "convergenceFailure:001");
  assert.equal(result.appendRequest.artifact.nextRequiredStage, "task-closeout");
  assert.equal("restoredExecutionState" in result.appendRequest.artifact, false);
});

test("records cancellation decision against auto-merge rejection", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);

  const result = cancelTaskAfterHumanDecisionRequest({
    taskContextPackage: autoMergeIssuePackage("autoMergeRejection"),
    repositoryDir,
    now: () => "2026-05-18T10:00:09.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "humanDecision");
  assert.equal(result.appendRequest.artifact.decision, "cancel-task");
  assert.equal(result.appendRequest.artifact.targetType, "autoMergeRejection");
  assert.equal(result.appendRequest.artifact.targetRef, "autoMergeRejection");
  assert.equal(result.appendRequest.artifact.nextRequiredStage, "task-closeout");
});
