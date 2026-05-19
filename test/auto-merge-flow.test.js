import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { planAutoMerge } from "../src/workflow/auto-merge-flow.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createGitRepositoryWithWorktree(t, { withChanges = true } = {}) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-auto-merge-"));
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
  const baseCommit = runGit(["rev-parse", "main"], repositoryDir);
  runGit([
    "worktree",
    "add",
    "-b",
    "workflow/tasks/tasks-task-003",
    ".workflow/worktrees/tasks/tasks-task-003",
    "main",
  ], repositoryDir);
  if (withChanges) {
    await writeFile(
      join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003", "result.txt"),
      "accepted work\n",
    );
  }

  return { repositoryDir, baseCommit };
}

function acceptedPackage(baseCommit) {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    currentWorkStage: "auto-merge",
    artifacts: {
      isolatedWorkspace: {
        artifactId: "isolatedWorkspace",
        body: {
          worktreePath: ".workflow/worktrees/tasks/tasks-task-003",
          branchName: "workflow/tasks/tasks-task-003",
          baseBranch: "main",
          baseCommit,
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
      humanDecision: {
        artifactId: "humanDecision",
        body: {
          decision: "accept-completion",
          decidedAt: "2026-05-18T10:00:08.000Z",
          taskCompletionRef: "taskCompletion",
          acceptedWork: {
            isolatedWorkspaceRef: "isolatedWorkspace",
            worktreePath: ".workflow/worktrees/tasks/tasks-task-003",
            branchName: "workflow/tasks/tasks-task-003",
            baseCommit,
          },
        },
        appendedAt: "2026-05-18T10:00:08.000Z",
      },
    },
  };
}

test("plans auto-merge when accepted worktree has changes", async (t) => {
  const { repositoryDir, baseCommit } = await createGitRepositoryWithWorktree(t);

  const result = planAutoMerge({
    taskContextPackage: acceptedPackage(baseCommit),
    repositoryDir,
    now: () => "2026-05-19T10:00:00.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "autoMergePlan");
  assert.equal(result.appendRequest.artifact.plannedAt, "2026-05-19T10:00:00.000Z");
  assert.equal(result.appendRequest.artifact.decisionRef, "humanDecision");
  assert.equal(result.appendRequest.artifact.source.worktreePath, ".workflow/worktrees/tasks/tasks-task-003");
  assert.equal(result.appendRequest.artifact.source.branchName, "workflow/tasks/tasks-task-003");
  assert.equal(result.appendRequest.artifact.source.baseCommit, baseCommit);
  assert.equal(result.appendRequest.artifact.target.branchName, "main");
  assert.equal(result.appendRequest.artifact.target.currentCommit, baseCommit);
  assert.deepEqual(result.appendRequest.artifact.changeSet.changedFiles, ["result.txt"]);
  assert.deepEqual(result.appendRequest.artifact.checks, [
    { name: "humanDecisionAccepted", passed: true },
    { name: "worktreeExists", passed: true },
    { name: "worktreeHeadMatchesAcceptedBase", passed: true },
    { name: "targetBranchAvailable", passed: true },
  ]);
  assert.equal("hasChanges" in result.appendRequest.artifact.changeSet, false);
  assert.equal("strategy" in result.appendRequest.artifact, false);
  assert.equal("nextRequiredStage" in result.appendRequest.artifact, false);
  assert.equal("taskCompletionRef" in result.appendRequest.artifact, false);
});

test("rejects auto-merge when worktree has no changes", async (t) => {
  const { repositoryDir, baseCommit } = await createGitRepositoryWithWorktree(t, {
    withChanges: false,
  });

  const result = planAutoMerge({
    taskContextPackage: acceptedPackage(baseCommit),
    repositoryDir,
    now: () => "2026-05-19T10:00:00.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "autoMergeRejection");
  assert.deepEqual(result.appendRequest.artifact.reasons, [
    {
      code: "NO_CHANGES",
      message: "隔离工作树没有可合并变更。",
    },
  ]);
  assert.deepEqual(result.appendRequest.artifact.checkedInputs, {
    currentWorkStage: "auto-merge",
    hasHumanDecision: true,
    hasTaskCompletion: true,
    hasIsolatedWorkspace: true,
  });
});

test("rejects auto-merge outside auto-merge stage", async (t) => {
  const { repositoryDir, baseCommit } = await createGitRepositoryWithWorktree(t);
  const taskPackage = acceptedPackage(baseCommit);
  taskPackage.currentWorkStage = "human-decision";

  const result = planAutoMerge({
    taskContextPackage: taskPackage,
    repositoryDir,
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "autoMergeRejection");
  assert.equal(result.appendRequest.artifact.reasons[0].code, "WRONG_STAGE");
});

test("rejects auto-merge when worktree head moved after acceptance", async (t) => {
  const { repositoryDir, baseCommit } = await createGitRepositoryWithWorktree(t);
  const worktreeDir = join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003");
  runGit(["add", "result.txt"], worktreeDir);
  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "commit accepted work",
  ], worktreeDir);

  const result = planAutoMerge({
    taskContextPackage: acceptedPackage(baseCommit),
    repositoryDir,
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "autoMergeRejection");
  assert.equal(result.appendRequest.artifact.reasons[0].code, "WORKTREE_HEAD_MISMATCH");
});
