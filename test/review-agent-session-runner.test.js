import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOpencodeReviewAgentSession } from "../src/workflow/review-agent-session-runner.js";
import { createReviewReadyPackageFixture } from "./support/review-ready-package-fixtures.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createGitRepositoryWithWorktree(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-review-runner-"));
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

test("runs opencode review session command in the isolated workspace", async (t) => {
  const repositoryDir = await createGitRepositoryWithWorktree(t);
  const worktreeDir = join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-003");
  const progress = [];
  const script = [
    "const text = '```json\\n' + JSON.stringify({ outcome: 'failed', summary: '真实 review 完成', findings: [{ code: 'missing-test', message: '缺少测试' }] }) + '\\n```';",
    "console.log(JSON.stringify({ type: 'session', sessionId: 'opencode-review-session:test' }));",
    "console.log(JSON.stringify({ type: 'text', part: { text } }));",
  ].join("");

  const session = await runOpencodeReviewAgentSession({
    role: "review",
    packageId: "task-context-package:tasks/task-003.yaml",
    cwd: worktreeDir,
    runId: "review-agent:001",
    taskContextPackage: createReviewReadyPackageFixture(),
    inputArtifactRefs: ["taskDraft", "executionAuthorization", "isolatedWorkspace", "executionReport:001"],
    command: process.execPath,
    args: ["-e", script],
    shell: false,
    onProgress: (entry) => progress.push(entry),
  });

  assert.equal(session.status, "succeeded");
  assert.equal(session.sessionId, "opencode-review-session:test");
  assert.equal(session.outcome, "failed");
  assert.equal(session.summary, "真实 review 完成");
  assert.deepEqual(session.findings, [{ code: "missing-test", message: "缺少测试" }]);
  assert.equal(progress[0].type, "review_process_start");
  assert.equal(progress.at(-1).type, "review_process_close");
  assert.equal(progress.some((entry) => entry.type === "review_stdout"), true);
});
