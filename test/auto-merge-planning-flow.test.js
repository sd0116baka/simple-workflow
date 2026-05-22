import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { planAutoMerge } from "../src/workflow/auto-merge-flow.js";
import {
  createAcceptedAutoMergePackage,
  createAutoMergeGitRepositoryWithWorktree,
  runGit,
} from "./support/auto-merge-flow-fixtures.js";

test("plans auto-merge when accepted worktree has changes", async (t) => {
  const { repositoryDir, baseCommit } = await createAutoMergeGitRepositoryWithWorktree(t);

  const result = planAutoMerge({
    taskContextPackage: createAcceptedAutoMergePackage(baseCommit),
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
  assert.equal(result.appendRequest.artifact.source.currentCommit, baseCommit);
  assert.equal(result.appendRequest.artifact.target.branchName, "main");
  assert.equal(result.appendRequest.artifact.target.currentCommit, baseCommit);
  assert.deepEqual(result.appendRequest.artifact.changeSet.changedFiles, ["result.txt"]);
  assert.deepEqual(result.appendRequest.artifact.checks, [
    { name: "humanDecisionAccepted", passed: true },
    { name: "worktreeExists", passed: true },
    { name: "worktreeHeadMatchesAcceptedBase", passed: true },
    { name: "worktreeContainsAcceptedWork", passed: true },
    { name: "targetBranchAvailable", passed: true },
  ]);
  assert.equal("hasChanges" in result.appendRequest.artifact.changeSet, false);
  assert.equal("strategy" in result.appendRequest.artifact, false);
  assert.equal("nextRequiredStage" in result.appendRequest.artifact, false);
  assert.equal("convergenceSuccessRef" in result.appendRequest.artifact, false);
});

test("plans auto-merge when accepted work was already committed by a failed execution", async (t) => {
  const { repositoryDir, baseCommit } = await createAutoMergeGitRepositoryWithWorktree(t);
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
  const sourceCommit = runGit(["rev-parse", "HEAD"], worktreeDir);

  const result = planAutoMerge({
    taskContextPackage: createAcceptedAutoMergePackage(baseCommit),
    repositoryDir,
    now: () => "2026-05-19T10:00:00.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "autoMergePlan");
  assert.equal(result.appendRequest.artifact.source.baseCommit, baseCommit);
  assert.equal(result.appendRequest.artifact.source.currentCommit, sourceCommit);
  assert.deepEqual(result.appendRequest.artifact.changeSet.changedFiles, ["result.txt"]);
  assert.deepEqual(result.appendRequest.artifact.checks, [
    { name: "humanDecisionAccepted", passed: true },
    { name: "worktreeExists", passed: true },
    { name: "worktreeHeadMatchesAcceptedBase", passed: false },
    { name: "worktreeContainsAcceptedWork", passed: true },
    { name: "targetBranchAvailable", passed: true },
  ]);
});

test("rejects auto-merge when worktree has no changes", async (t) => {
  const { repositoryDir, baseCommit } = await createAutoMergeGitRepositoryWithWorktree(t, {
    withChanges: false,
  });

  const result = planAutoMerge({
    taskContextPackage: createAcceptedAutoMergePackage(baseCommit),
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
    currentWorkStage: "auto-merge-planning",
    hasHumanDecision: true,
    hasConvergenceSuccess: true,
    hasIsolatedWorkspace: true,
  });
});

test("rejects auto-merge outside auto-merge stage", async (t) => {
  const { repositoryDir, baseCommit } = await createAutoMergeGitRepositoryWithWorktree(t);
  const taskPackage = createAcceptedAutoMergePackage(baseCommit);
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
  const { repositoryDir } = await createAutoMergeGitRepositoryWithWorktree(t);
  await writeFile(join(repositoryDir, "new-main.txt"), "new main work\n");
  runGit(["add", "new-main.txt"], repositoryDir);
  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "move main",
  ], repositoryDir);
  const newMainCommit = runGit(["rev-parse", "main"], repositoryDir);

  const result = planAutoMerge({
    taskContextPackage: createAcceptedAutoMergePackage(newMainCommit),
    repositoryDir,
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "autoMergeRejection");
  assert.equal(result.appendRequest.artifact.reasons[0].code, "WORKTREE_HEAD_MISMATCH");
});
