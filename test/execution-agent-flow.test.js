import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runExecutionAgent } from "../src/workflow/execution-agent-flow.js";
import { createArtifactRecordFixture } from "./support/task-context-package-fixtures.js";
import { createExecutionSessionPackageFixture } from "./support/execution-session-package-fixtures.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createGitRepositoryWithWorktree(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-execution-"));
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

  return repositoryDir;
}

function executablePackage(worktreePath = ".workflow/worktrees/tasks/tasks-task-003") {
  return createExecutionSessionPackageFixture({ worktreePath });
}

test("runs execution agent stub in the isolated workspace cwd", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const result = await runExecutionAgent({
    taskContextPackage: executablePackage(),
    repositoryDir,
    now: () => "2026-05-18T10:00:01.000Z",
  });

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.appendRequest.artifactType, "executionReport");
  assert.equal(result.appendRequest.artifact.summary, "stub execution completed");
  assert.equal(result.appendRequest.artifact.status, "succeeded");
  assert.equal(result.appendRequest.artifact.cwd, ".workflow/worktrees/tasks/tasks-task-003");
  assert.deepEqual(result.appendRequest.artifact.changedFiles, [
    ".workflow-agent/task-003/aaaaaaaaaaaa/execution-agent-001.txt",
  ]);
  assert.equal(
    existsSync(join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003", ".workflow-agent", "task-003", "aaaaaaaaaaaa", "execution-agent-001.txt")),
    true,
  );
  assert.equal(result.appendRequest.agentRun.runId, "execution-agent:001");
  assert.equal(result.appendRequest.agentRun.role, "execution");
  assert.equal(
    result.appendRequest.agentRun.sessionId,
    "stub-execution-session:task-context-package:tasks/task-003.yaml",
  );
  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "isolatedWorkspace",
  ]);
});

test("passes isolated workspace cwd to a supplied execution runner", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  let observed = null;
  const result = await runExecutionAgent({
    taskContextPackage: executablePackage(),
    repositoryDir,
    onProgress: () => {},
    runAgentSession: ({ cwd, runId, inputArtifactRefs, onProgress }) => {
      observed = { cwd, runId, inputArtifactRefs, hasOnProgress: typeof onProgress === "function" };
      return {
        sessionId: "session:execution:custom",
        status: "succeeded",
        notes: ["custom execution runner completed"],
      };
    },
  });

  assert.equal(result.error, null);
  assert.equal(observed.runId, "execution-agent:001");
  assert.equal(observed.hasOnProgress, true);
  assert.equal(observed.cwd, join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003"));
  assert.deepEqual(observed.inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "isolatedWorkspace",
  ]);
  assert.deepEqual(result.appendRequest.artifact.changedFiles, []);
  assert.deepEqual(result.appendRequest.artifact.notes, ["custom execution runner completed"]);
});

test("increments execution agent run id from existing execution reports", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const taskPackage = executablePackage();
  taskPackage.artifacts.executionReport = [
    createArtifactRecordFixture("executionReport:001", {}, {
      appendedAt: "2026-05-18T10:00:01.000Z",
    }),
  ];

  const result = await runExecutionAgent({
    taskContextPackage: taskPackage,
    repositoryDir,
  });

  assert.equal(result.appendRequest.agentRun.runId, "execution-agent:002");
});

test("uses latest convergence advice as next execution input", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const taskPackage = executablePackage();
  taskPackage.artifacts.executionReport = [
    createArtifactRecordFixture("executionReport:001", {}, {
      appendedAt: "2026-05-18T10:00:01.000Z",
    }),
  ];
  taskPackage.artifacts.convergenceAdvice = [
    createArtifactRecordFixture("convergenceAdvice:001", {}, {
      appendedAt: "2026-05-18T10:00:03.000Z",
    }),
  ];

  const result = await runExecutionAgent({
    taskContextPackage: taskPackage,
    repositoryDir,
  });

  assert.equal(result.appendRequest.agentRun.runId, "execution-agent:002");
  assert.deepEqual(result.appendRequest.artifact.changedFiles, [
    ".workflow-agent/task-003/aaaaaaaaaaaa/execution-agent-002.txt",
  ]);
  assert.deepEqual(result.appendRequest.agentRun.inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
    "isolatedWorkspace",
  ]);
});

test("does not run execution agent before isolated workspace is allocated", async () => {
  const taskPackage = executablePackage();
  delete taskPackage.artifacts.isolatedWorkspace;

  const result = await runExecutionAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 isolatedWorkspace/);
});

test("does not run execution agent before main agent is initialized", async () => {
  const taskPackage = executablePackage();
  taskPackage.agentRuns = [];

  const result = await runExecutionAgent({
    taskContextPackage: taskPackage,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /缺少 main agent 初始化记录/);
});

test("does not run execution agent when isolated workspace path is missing", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const taskPackage = executablePackage(".workflow/worktrees/tasks/missing-task");

  const result = await runExecutionAgent({
    taskContextPackage: taskPackage,
    repositoryDir,
  });

  assert.equal(result.appendRequest, null);
  assert.match(result.error, /路径不存在/);
});
