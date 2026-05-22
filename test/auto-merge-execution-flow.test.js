import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { executeAutoMerge, planAutoMerge } from "../src/workflow/auto-merge-flow.js";
import {
  createAcceptedAutoMergePackage,
  createAutoMergeExecutionPackage,
  createAutoMergeGitRepositoryWithWorktree,
  runGit,
} from "./support/auto-merge-flow-fixtures.js";

test("executes auto-merge with a fast-forward merge", async (t) => {
  const { repositoryDir, baseCommit } = await createAutoMergeGitRepositoryWithWorktree(t);
  const planning = planAutoMerge({
    taskContextPackage: createAcceptedAutoMergePackage(baseCommit),
    repositoryDir,
    now: () => "2026-05-19T10:00:00.000Z",
  });

  const result = executeAutoMerge({
    taskContextPackage: createAutoMergeExecutionPackage(baseCommit, planning.appendRequest.artifact),
    repositoryDir,
    now: () => "2026-05-19T10:05:00.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "autoMergeResult");
  assert.equal(result.appendRequest.artifact.mergedAt, "2026-05-19T10:05:00.000Z");
  assert.equal(result.appendRequest.artifact.planRef, "autoMergePlan");
  assert.equal(result.appendRequest.artifact.source.baseCommit, baseCommit);
  assert.match(result.appendRequest.artifact.source.commit, /^[0-9a-f]{40}$/);
  assert.equal(result.appendRequest.artifact.target.branchName, "main");
  assert.equal(result.appendRequest.artifact.target.beforeCommit, baseCommit);
  assert.equal(
    result.appendRequest.artifact.target.afterCommit,
    result.appendRequest.artifact.source.commit,
  );
  assert.deepEqual(result.appendRequest.artifact.changeSet.changedFiles, ["result.txt"]);
  assert.deepEqual(result.appendRequest.artifact.checks, [
    { name: "mainWorktreeClean", passed: true },
    { name: "targetStillAtPlannedCommit", passed: true },
    { name: "sourceCommitted", passed: true },
    { name: "sourceRebasedOntoTarget", passed: false },
    { name: "mergedFastForward", passed: true },
  ]);
  assert.equal(
    (await readFile(join(repositoryDir, "result.txt"), "utf8")).replace(/\r\n/g, "\n"),
    "accepted work\n",
  );
});

test("executes auto-merge when accepted work was already committed", async (t) => {
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
  const planning = planAutoMerge({
    taskContextPackage: createAcceptedAutoMergePackage(baseCommit),
    repositoryDir,
    now: () => "2026-05-19T10:00:00.000Z",
  });

  const result = executeAutoMerge({
    taskContextPackage: createAutoMergeExecutionPackage(baseCommit, planning.appendRequest.artifact),
    repositoryDir,
    now: () => "2026-05-19T10:05:00.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "autoMergeResult");
  assert.equal(result.appendRequest.artifact.source.commit, sourceCommit);
  assert.equal(result.appendRequest.artifact.target.beforeCommit, baseCommit);
  assert.equal(result.appendRequest.artifact.target.afterCommit, sourceCommit);
  assert.deepEqual(result.appendRequest.artifact.changeSet.changedFiles, ["result.txt"]);
  assert.deepEqual(result.appendRequest.artifact.checks, [
    { name: "mainWorktreeClean", passed: true },
    { name: "targetStillAtPlannedCommit", passed: true },
    { name: "sourceCommitted", passed: true },
    { name: "sourceRebasedOntoTarget", passed: false },
    { name: "mergedFastForward", passed: true },
  ]);
  assert.equal(
    (await readFile(join(repositoryDir, "result.txt"), "utf8")).replace(/\r\n/g, "\n"),
    "accepted work\n",
  );
});

test("rebases accepted work onto the target before fast-forward merge", async (t) => {
  const { repositoryDir, baseCommit } = await createAutoMergeGitRepositoryWithWorktree(t);
  await writeFile(join(repositoryDir, "target-before-plan.txt"), "target moved before plan\n");
  runGit(["add", "target-before-plan.txt"], repositoryDir);
  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "move target before plan",
  ], repositoryDir);
  const targetCommit = runGit(["rev-parse", "main"], repositoryDir);
  const planning = planAutoMerge({
    taskContextPackage: createAcceptedAutoMergePackage(baseCommit),
    repositoryDir,
    now: () => "2026-05-19T10:00:00.000Z",
  });

  assert.equal(planning.appendRequest.artifact.target.currentCommit, targetCommit);

  const result = executeAutoMerge({
    taskContextPackage: createAutoMergeExecutionPackage(baseCommit, planning.appendRequest.artifact),
    repositoryDir,
    now: () => "2026-05-19T10:05:00.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "autoMergeResult");
  assert.equal(result.appendRequest.artifact.target.beforeCommit, targetCommit);
  assert.equal(
    result.appendRequest.artifact.target.afterCommit,
    result.appendRequest.artifact.source.commit,
  );
  assert.deepEqual(result.appendRequest.artifact.changeSet.changedFiles, ["result.txt"]);
  assert.deepEqual(result.appendRequest.artifact.checks, [
    { name: "mainWorktreeClean", passed: true },
    { name: "targetStillAtPlannedCommit", passed: true },
    { name: "sourceCommitted", passed: true },
    { name: "sourceRebasedOntoTarget", passed: true },
    { name: "mergedFastForward", passed: true },
  ]);
  assert.equal(
    (await readFile(join(repositoryDir, "result.txt"), "utf8")).replace(/\r\n/g, "\n"),
    "accepted work\n",
  );
});

test("fails auto-merge execution when target branch moved", async (t) => {
  const { repositoryDir, baseCommit } = await createAutoMergeGitRepositoryWithWorktree(t);
  const planning = planAutoMerge({
    taskContextPackage: createAcceptedAutoMergePackage(baseCommit),
    repositoryDir,
  });
  await writeFile(join(repositoryDir, "target-moved.txt"), "new target work\n");
  runGit(["add", "target-moved.txt"], repositoryDir);
  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "move target",
  ], repositoryDir);

  const result = executeAutoMerge({
    taskContextPackage: createAutoMergeExecutionPackage(baseCommit, planning.appendRequest.artifact),
    repositoryDir,
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "autoMergeFailure");
  assert.equal(result.appendRequest.artifact.reasons[0].code, "TARGET_MOVED");
  assert.deepEqual(result.appendRequest.artifact.checkedInputs, {
    currentWorkStage: "auto-merge-execution",
    hasAutoMergePlan: true,
    hasIsolatedWorkspace: true,
    hasHumanDecision: true,
  });
});

test("fails auto-merge execution when main worktree is dirty", async (t) => {
  const { repositoryDir, baseCommit } = await createAutoMergeGitRepositoryWithWorktree(t);
  const planning = planAutoMerge({
    taskContextPackage: createAcceptedAutoMergePackage(baseCommit),
    repositoryDir,
  });
  await writeFile(join(repositoryDir, "dirty.txt"), "dirty\n");

  const result = executeAutoMerge({
    taskContextPackage: createAutoMergeExecutionPackage(baseCommit, planning.appendRequest.artifact),
    repositoryDir,
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "autoMergeFailure");
  assert.equal(result.appendRequest.artifact.reasons[0].code, "MAIN_WORKTREE_DIRTY");
});

test("fails auto-merge execution clearly when a stale plan has no staged changes", async (t) => {
  const { repositoryDir, baseCommit } = await createAutoMergeGitRepositoryWithWorktree(t, {
    withChanges: false,
  });
  const stalePlan = {
    plannedAt: "2026-05-19T10:00:00.000Z",
    decisionRef: "humanDecision",
    source: {
      worktreePath: ".workflow/worktrees/tasks/tasks-task-003",
      branchName: "workflow/tasks/tasks-task-003",
      baseCommit,
    },
    target: {
      branchName: "main",
      currentCommit: baseCommit,
    },
    changeSet: {
      changedFiles: ["README.md"],
    },
    checks: [
      { name: "humanDecisionAccepted", passed: true },
      { name: "worktreeExists", passed: true },
      { name: "worktreeHeadMatchesAcceptedBase", passed: true },
      { name: "targetBranchAvailable", passed: true },
    ],
  };

  const result = executeAutoMerge({
    taskContextPackage: createAutoMergeExecutionPackage(baseCommit, stalePlan),
    repositoryDir,
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "autoMergeFailure");
  assert.deepEqual(result.appendRequest.artifact.reasons, [
    {
      code: "NO_CHANGES",
      message: "隔离工作树没有可提交变更。",
    },
  ]);
});
