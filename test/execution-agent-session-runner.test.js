import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOpencodeExecutionAgentSession } from "../src/workflow/execution-agent-session-runner.js";
import { createExecutionSessionPackageFixture } from "./support/execution-session-package-fixtures.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createGitRepositoryWithWorktree(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-execution-runner-"));
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

test("runs opencode execution session command in the isolated workspace", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const worktreeDir = join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003");
  const progress = [];
  const script = [
    "const fs = require('node:fs');",
    "fs.writeFileSync('agent-output.txt', 'changed by fake execution agent\\n');",
    "const text = '```json\\n' + JSON.stringify({ summary: '真实 runner 完成', tests: [{ command: 'npm test', status: 'not-run' }], notes: ['fake command'] }) + '\\n```';",
    "console.log(JSON.stringify({ type: 'session', sessionId: 'opencode-session:test' }));",
    "console.log(JSON.stringify({ type: 'text', part: { text } }));",
  ].join("");

  const session = await runOpencodeExecutionAgentSession({
    role: "execution",
    packageId: "task-context-package:tasks/task-003.yaml",
    cwd: worktreeDir,
    runId: "execution-agent:001",
    taskContextPackage: executablePackage(),
    inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization", "isolatedWorkspace"],
    command: process.execPath,
    args: ["-e", script],
    shell: false,
    onProgress: (entry) => progress.push(entry),
  });

  assert.equal(session.status, "succeeded");
  assert.equal(session.sessionId, "opencode-session:test");
  assert.equal(session.summary, "真实 runner 完成");
  assert.deepEqual(session.tests, [{ command: "npm test", status: "not-run" }]);
  assert.deepEqual(session.notes, ["fake command"]);
  assert.equal(progress[0].type, "execution_process_start");
  assert.equal(progress.at(-1).type, "execution_process_close");
  assert.equal(progress.some((entry) => entry.type === "execution_stdout"), true);
  assert.equal(existsSync(join(worktreeDir, "agent-output.txt")), true);
});

test("execution session records structured process failures", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const worktreeDir = join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003");

  const session = await runOpencodeExecutionAgentSession({
    role: "execution",
    packageId: "task-context-package:tasks/task-003.yaml",
    cwd: worktreeDir,
    runId: "execution-agent:001",
    taskContextPackage: executablePackage(),
    inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization", "isolatedWorkspace"],
    command: process.execPath,
    args: ["-e", "process.stderr.write('execution boom'); process.exit(2);"],
    shell: false,
  });

  assert.equal(session.status, "failed");
  assert.equal(session.failure.code, "agent.non-zero-exit");
  assert.equal(session.failure.message, "execution boom");
  assert.equal(session.rawOutput.failure, session.failure);
  assert.equal(session.summary, "execution boom");
});
