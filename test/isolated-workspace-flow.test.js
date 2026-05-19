import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { allocateIsolatedWorkspace } from "../src/workflow/isolated-workspace-flow.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createGitRepository(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-worktree-"));
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

  return repositoryDir;
}

function authorizedPackage() {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    source: {
      path: "tasks/task-003.yaml",
    },
    artifacts: {
      executionAuthorization: {
        artifactId: "executionAuthorization",
        body: {},
        appendedAt: "2026-05-18T09:01:00.000Z",
      },
    },
  };
}

test("allocates a task-scoped git worktree", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const result = allocateIsolatedWorkspace({
    taskContextPackage: authorizedPackage(),
    repositoryDir,
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "isolatedWorkspace");
  assert.equal(result.appendRequest.artifact.worktreePath, ".workflow/worktrees/tasks/tasks-task-003");
  assert.equal(result.appendRequest.artifact.branchName, "workflow/tasks/tasks-task-003");
  assert.equal(result.appendRequest.artifact.baseBranch, "main");
  assert.match(result.appendRequest.artifact.baseCommit, /^[0-9a-f]{40}$/);
  assert.equal(result.appendRequest.artifact.status, "ready");
  assert.equal(
    existsSync(join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003")),
    true,
  );
  assert.equal(
    runGit(["branch", "--show-current"], join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003")),
    "workflow/tasks/tasks-task-003",
  );
});

test("reuses an existing registered git worktree for the same task", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const first = allocateIsolatedWorkspace({
    taskContextPackage: authorizedPackage(),
    repositoryDir,
  });
  const second = allocateIsolatedWorkspace({
    taskContextPackage: authorizedPackage(),
    repositoryDir,
  });

  assert.equal(first.error, null);
  assert.equal(second.error, null);
  assert.deepEqual(second.appendRequest.artifact, {
    worktreePath: ".workflow/worktrees/tasks/tasks-task-003",
    branchName: "workflow/tasks/tasks-task-003",
    baseBranch: "main",
    baseCommit: first.appendRequest.artifact.baseCommit,
    status: "ready",
  });
});

test("records the actual worktree head when reusing an older registered worktree", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const first = allocateIsolatedWorkspace({
    taskContextPackage: authorizedPackage(),
    repositoryDir,
  });
  await writeFile(join(repositoryDir, "CHANGELOG.md"), "main changed\n");
  runGit(["add", "CHANGELOG.md"], repositoryDir);
  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "advance main",
  ], repositoryDir);
  const second = allocateIsolatedWorkspace({
    taskContextPackage: authorizedPackage(),
    repositoryDir,
  });

  assert.equal(first.error, null);
  assert.equal(second.error, null);
  assert.equal(second.appendRequest.artifact.baseCommit, first.appendRequest.artifact.baseCommit);
  assert.notEqual(second.appendRequest.artifact.baseCommit, runGit(["rev-parse", "HEAD"], repositoryDir));
});

test("does not claim readiness when a registered worktree path is missing", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const first = allocateIsolatedWorkspace({
    taskContextPackage: authorizedPackage(),
    repositoryDir,
  });
  await rm(join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003"), {
    recursive: true,
    force: true,
  });
  const second = allocateIsolatedWorkspace({
    taskContextPackage: authorizedPackage(),
    repositoryDir,
  });

  assert.equal(first.error, null);
  assert.equal(second.appendRequest, null);
  assert.match(second.error, /路径不存在/);
});

test("does not allocate isolated workspace before execution authorization", () => {
  const taskPackage = authorizedPackage();
  delete taskPackage.artifacts.executionAuthorization;

  const result = allocateIsolatedWorkspace({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少执行授权/);
});
