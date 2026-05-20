import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acceptTaskCompletion,
  cancelTaskAfterConvergenceFailure,
  provideHumanConvergenceGuidance,
  requestHumanDecisionForConvergenceFailure,
  requestHumanDecisionForTaskCompletion,
} from "../src/workflow/human-decision-flow.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitSucceeds(args, cwd) {
  try {
    runGit(args, cwd);
    return true;
  } catch {
    return false;
  }
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
      taskCompletion: {
        artifactId: "taskCompletion",
        body: {
          summary: "stub task completed",
        },
        appendedAt: "2026-05-18T10:00:06.000Z",
      },
      humanDecisionRequest: {
        artifactId: "humanDecisionRequest",
        body: {
          requestedAt: "2026-05-18T10:00:07.000Z",
          taskCompletionRef: "taskCompletion",
          decisionOptions: ["accept-completion", "request-changes"],
        },
        appendedAt: "2026-05-18T10:00:07.000Z",
      },
    },
  };
}

function convergenceFailedPackage() {
  const taskPackage = completedPackage();
  delete taskPackage.artifacts.taskCompletion;
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
      decisionOptions: ["retry-with-guidance", "cancel-task"],
    },
    appendedAt: "2026-05-18T10:00:07.000Z",
  };
  return taskPackage;
}

test("requests human decision after task completion", () => {
  const result = requestHumanDecisionForTaskCompletion({
    taskContextPackage: completedPackage(),
    now: () => "2026-05-18T10:00:07.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(result.appendRequest.artifact.requestedAt, "2026-05-18T10:00:07.000Z");
  assert.equal(result.appendRequest.artifact.taskCompletionRef, "taskCompletion");
  assert.deepEqual(result.appendRequest.artifact.decisionOptions, [
    "accept-completion",
    "request-changes",
  ]);
});

test("accepts task completion and prepares auto-merge input", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);

  const result = acceptTaskCompletion({
    taskContextPackage: completedPackage(),
    repositoryDir,
    now: () => "2026-05-18T10:00:08.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "humanDecision");
  assert.equal(result.appendRequest.artifact.decision, "accept-completion");
  assert.equal(result.appendRequest.artifact.decidedAt, "2026-05-18T10:00:08.000Z");
  assert.equal(result.appendRequest.artifact.taskCompletionRef, "taskCompletion");
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

test("does not accept task completion outside human-decision stage", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const taskPackage = completedPackage();
  taskPackage.currentWorkStage = "task-completion";

  const result = acceptTaskCompletion({
    taskContextPackage: taskPackage,
    repositoryDir,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /human-decision/);
});

test("does not request human decision before task completion exists", () => {
  const taskPackage = completedPackage();
  delete taskPackage.artifacts.taskCompletion;

  const result = requestHumanDecisionForTaskCompletion({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 taskCompletion/);
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
    "retry-with-guidance",
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
  assert.equal(result.appendRequest.artifact.convergenceFailureRef, "convergenceFailure:001");
  assert.equal(result.appendRequest.artifact.guidance, "下一轮先收窄状态泄漏，再验证 candidateTasks。");
  assert.deepEqual(result.appendRequest.artifact.focusAreas, ["candidateTasks"]);
  assert.deepEqual(result.appendRequest.artifact.avoidRepeating, ["不要继续只改 UI 标签"]);
  assert.equal(result.appendRequest.artifact.expectedNextOutcome, "证明 human-decision 任务不再进入候选集。");
});

test("cancels convergence-failed task only after execution resources are removed", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const taskPackage = convergenceFailedPackage();
  const worktreeDir = join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003");

  const result = cancelTaskAfterConvergenceFailure({
    taskContextPackage: taskPackage,
    repositoryDir,
    now: () => "2026-05-18T10:00:09.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "humanDecision");
  assert.equal(result.appendRequest.artifact.decision, "cancel-task");
  assert.equal(result.appendRequest.artifact.targetRef, "convergenceFailure:001");
  assert.equal(result.appendRequest.artifact.restoredExecutionState.restored, true);
  assert.equal(existsSync(worktreeDir), false);
  assert.equal(
    gitSucceeds(["show-ref", "--verify", "--quiet", "refs/heads/workflow/tasks/tasks-task-003"], repositoryDir),
    false,
  );
});
