import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOpencodeMainAgentSession } from "../src/workflow/main-agent-session-runner.js";
import { createReviewReadyPackageFixture } from "./support/review-ready-package-fixtures.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createGitRepositoryWithWorktree(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-main-runner-"));
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

test("runs opencode main session command in the isolated workspace", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const worktreeDir = join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003");
  const progress = [];
  const script = [
    "const text = '```json\\n' + JSON.stringify({ summary: '真实 main 完成', nextAction: '继续执行审查建议', findings: [{ code: 'needs-follow-up' }] }) + '\\n```';",
    "console.log(JSON.stringify({ type: 'session', sessionId: 'opencode-main-session:test' }));",
    "console.log(JSON.stringify({ type: 'text', part: { text } }));",
  ].join("");

  const session = await runOpencodeMainAgentSession({
    role: "main",
    packageId: "task-context-package:tasks/task-003.yaml",
    cwd: worktreeDir,
    runId: "main-agent:convergence:001",
    sessionId: "session:main",
    taskContextPackage: createReviewReadyPackageFixture(),
    inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization"],
    command: process.execPath,
    args: ["-e", script],
    shell: false,
    onProgress: (entry) => progress.push(entry),
  });

  assert.equal(session.status, "succeeded");
  assert.equal(session.sessionId, "opencode-main-session:test");
  assert.equal(session.summary, "真实 main 完成");
  assert.equal(session.nextAction, "继续执行审查建议");
  assert.deepEqual(session.findings, [{ code: "needs-follow-up" }]);
  assert.equal(progress[0].type, "main_process_start");
  assert.equal(progress.at(-1).type, "main_process_close");
  assert.equal(progress.some((entry) => entry.type === "main_stdout"), true);
});
