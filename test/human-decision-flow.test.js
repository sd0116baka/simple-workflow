import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acceptTaskCompletion,
  requestHumanDecisionForTaskCompletion,
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
  assert.equal(result.appendRequest.artifact.nextRequiredStage, "auto-merge");
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
