import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { closeTask, closeTaskWithoutMerge } from "../src/workflow/task-closeout-flow.js";

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

async function createMergedTaskRepository(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-closeout-"));
  t.after(() => rm(repositoryDir, { recursive: true, force: true }));

  runGit(["init", "-b", "main"], repositoryDir);
  await writeFile(join(repositoryDir, "README.md"), "test repository\n");
  await writeFile(join(repositoryDir, ".gitignore"), ".workflow/\n");
  runGit(["add", "README.md", ".gitignore"], repositoryDir);
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
  const worktreePath = ".workflow/worktrees/tasks/tasks-task-003";
  const branchName = "workflow/tasks/tasks-task-003";
  const worktreeDir = join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003");
  runGit([
    "worktree",
    "add",
    "-b",
    branchName,
    worktreePath,
    "main",
  ], repositoryDir);
  await writeFile(join(worktreeDir, "result.txt"), "accepted work\n");
  runGit(["add", "result.txt"], worktreeDir);
  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "accepted work",
  ], worktreeDir);
  const sourceCommit = runGit(["rev-parse", "HEAD"], worktreeDir);
  runGit(["merge", "--ff-only", sourceCommit], repositoryDir);

  return {
    repositoryDir,
    baseCommit,
    sourceCommit,
    worktreePath,
    branchName,
    worktreeDir,
  };
}

function mergedPackage({
  baseCommit,
  sourceCommit,
  worktreePath = ".workflow/worktrees/tasks/tasks-task-003",
  branchName = "workflow/tasks/tasks-task-003",
} = {}) {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    currentWorkStage: "merged",
    artifacts: {
      isolatedWorkspace: {
        artifactId: "isolatedWorkspace",
        body: {
          worktreePath,
          branchName,
          baseBranch: "main",
          baseCommit,
          status: "ready",
        },
        appendedAt: "2026-05-19T10:00:04.000Z",
      },
      autoMergeResult: {
        artifactId: "autoMergeResult",
        body: {
          mergedAt: "2026-05-19T10:05:00.000Z",
          planRef: "autoMergePlan",
          source: {
            worktreePath,
            branchName,
            baseCommit,
            commit: sourceCommit,
          },
          target: {
            branchName: "main",
            beforeCommit: baseCommit,
            afterCommit: sourceCommit,
          },
          changeSet: {
            changedFiles: ["result.txt"],
          },
        },
        appendedAt: "2026-05-19T10:05:00.000Z",
      },
    },
  };
}

async function createNoChangeTaskRepository(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-no-change-closeout-"));
  t.after(() => rm(repositoryDir, { recursive: true, force: true }));

  runGit(["init", "-b", "main"], repositoryDir);
  await writeFile(join(repositoryDir, "README.md"), "test repository\n");
  await writeFile(join(repositoryDir, ".gitignore"), ".workflow/\n");
  runGit(["add", "README.md", ".gitignore"], repositoryDir);
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
  const worktreePath = ".workflow/worktrees/tasks/tasks-task-004";
  const branchName = "workflow/tasks/tasks-task-004";
  const worktreeDir = join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-004");
  runGit([
    "worktree",
    "add",
    "-b",
    branchName,
    worktreePath,
    "main",
  ], repositoryDir);

  return {
    repositoryDir,
    baseCommit,
    worktreePath,
    branchName,
    worktreeDir,
  };
}

function noChangePackage({
  baseCommit,
  worktreePath = ".workflow/worktrees/tasks/tasks-task-004",
  branchName = "workflow/tasks/tasks-task-004",
} = {}) {
  return {
    packageId: "task-context-package:tasks/task-004.yaml",
    currentWorkStage: "human-decision",
    artifacts: {
      isolatedWorkspace: {
        artifactId: "isolatedWorkspace",
        body: {
          worktreePath,
          branchName,
          baseBranch: "main",
          baseCommit,
          status: "ready",
        },
        appendedAt: "2026-05-19T10:00:04.000Z",
      },
      taskCompletion: {
        artifactId: "taskCompletion",
        body: {
          summary: "agent reported completion",
          basis: ["executionReport:001", "reviewReport:001"],
        },
        appendedAt: "2026-05-19T10:04:00.000Z",
      },
      humanDecision: {
        artifactId: "humanDecision",
        body: {
          decision: "accept-completion",
          decidedAt: "2026-05-19T10:05:00.000Z",
          taskCompletionRef: "taskCompletion",
          acceptedWork: {
            isolatedWorkspaceRef: "isolatedWorkspace",
            worktreePath,
            branchName,
            baseCommit,
          },
          worktreeSnapshot: {
            cwd: worktreePath,
            changedFiles: [],
          },
          nextRequiredStage: "auto-merge",
        },
        appendedAt: "2026-05-19T10:05:00.000Z",
      },
      autoMergeRejection: {
        artifactId: "autoMergeRejection",
        body: {
          rejectedAt: "2026-05-19T10:06:00.000Z",
          decisionRef: "humanDecision",
          reasons: [
            {
              code: "NO_CHANGES",
              message: "隔离工作树没有可合并变更。",
            },
          ],
        },
        appendedAt: "2026-05-19T10:06:00.000Z",
      },
    },
  };
}

test("closes a merged task and removes worktree plus branch", async (t) => {
  const repository = await createMergedTaskRepository(t);

  const result = closeTask({
    taskContextPackage: mergedPackage(repository),
    repositoryDir: repository.repositoryDir,
    now: () => "2026-05-19T10:10:00.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "taskCloseout");
  assert.equal(result.appendRequest.artifact.closedAt, "2026-05-19T10:10:00.000Z");
  assert.equal(result.appendRequest.artifact.resultRef, "autoMergeResult");
  assert.deepEqual(result.appendRequest.artifact.cleanup, {
    worktree: {
      path: ".workflow/worktrees/tasks/tasks-task-003",
      removed: true,
    },
    branch: {
      name: "workflow/tasks/tasks-task-003",
      deleted: true,
    },
  });
  assert.equal(result.appendRequest.artifact.finalStage, "closed");
  assert.equal(existsSync(repository.worktreeDir), false);
  assert.equal(
    gitSucceeds(["show-ref", "--verify", "--quiet", "refs/heads/workflow/tasks/tasks-task-003"], repository.repositoryDir),
    false,
  );
});

test("closes an accepted task without merge when auto-merge found no changes", async (t) => {
  const repository = await createNoChangeTaskRepository(t);

  const result = closeTaskWithoutMerge({
    taskContextPackage: noChangePackage(repository),
    repositoryDir: repository.repositoryDir,
    now: () => "2026-05-19T10:10:00.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-004.yaml");
  assert.equal(result.appendRequest.artifactType, "taskCloseout");
  assert.equal(result.appendRequest.artifact.closedAt, "2026-05-19T10:10:00.000Z");
  assert.equal(result.appendRequest.artifact.resultRef, "autoMergeRejection");
  assert.equal(result.appendRequest.artifact.closeoutReason, "no-merge-needed");
  assert.equal(result.appendRequest.artifact.finalStage, "closed");
  assert.equal(existsSync(repository.worktreeDir), false);
  assert.equal(
    gitSucceeds(["show-ref", "--verify", "--quiet", "refs/heads/workflow/tasks/tasks-task-004"], repository.repositoryDir),
    false,
  );
});

test("does not close without merge when no-change worktree now has changes", async (t) => {
  const repository = await createNoChangeTaskRepository(t);
  await writeFile(join(repository.worktreeDir, "unexpected.txt"), "new work\n");

  const result = closeTaskWithoutMerge({
    taskContextPackage: noChangePackage(repository),
    repositoryDir: repository.repositoryDir,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /已经出现变更/);
  assert.equal(existsSync(repository.worktreeDir), true);
  assert.equal(
    gitSucceeds(["show-ref", "--verify", "--quiet", "refs/heads/workflow/tasks/tasks-task-004"], repository.repositoryDir),
    true,
  );
});

test("closes a merged task when only a residual worktree directory remains", async (t) => {
  const repository = await createMergedTaskRepository(t);
  runGit(["worktree", "remove", "--force", repository.worktreeDir], repository.repositoryDir);
  await mkdir(repository.worktreeDir, { recursive: true });
  await writeFile(join(repository.worktreeDir, "leftover.txt"), "residual file\n");

  const result = closeTask({
    taskContextPackage: mergedPackage(repository),
    repositoryDir: repository.repositoryDir,
    now: () => "2026-05-19T10:10:00.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "taskCloseout");
  assert.equal(existsSync(repository.worktreeDir), false);
  assert.equal(
    gitSucceeds(["show-ref", "--verify", "--quiet", "refs/heads/workflow/tasks/tasks-task-003"], repository.repositoryDir),
    false,
  );
});

test("does not close a task before merged stage", async (t) => {
  const repository = await createMergedTaskRepository(t);
  const taskPackage = mergedPackage(repository);
  taskPackage.currentWorkStage = "auto-merge-execution";

  const result = closeTask({
    taskContextPackage: taskPackage,
    repositoryDir: repository.repositoryDir,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /merged/);
});

test("does not delete branch unless source commit is merged", async (t) => {
  const repository = await createMergedTaskRepository(t);
  const taskPackage = mergedPackage(repository);
  taskPackage.artifacts.autoMergeResult.body.source.commit = repository.baseCommit;

  const result = closeTask({
    taskContextPackage: taskPackage,
    repositoryDir: repository.repositoryDir,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /不能删除任务分支/);
  assert.equal(existsSync(repository.worktreeDir), true);
  assert.equal(
    gitSucceeds(["show-ref", "--verify", "--quiet", "refs/heads/workflow/tasks/tasks-task-003"], repository.repositoryDir),
    true,
  );
});
