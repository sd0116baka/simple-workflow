import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";

export function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export async function createAutoMergeGitRepositoryWithWorktree(
  t,
  { withChanges = true } = {},
) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-auto-merge-"));
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

export function createAcceptedAutoMergePackage(baseCommit) {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    currentWorkStage: "auto-merge-planning",
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
      convergenceSuccess: {
        artifactId: "convergenceSuccess",
        body: {
          summary: "stub task completed",
        },
        appendedAt: "2026-05-18T10:00:06.000Z",
      },
      humanDecision: {
        artifactId: "humanDecision",
        body: {
          decision: "accept-convergence",
          decidedAt: "2026-05-18T10:00:08.000Z",
          convergenceSuccessRef: "convergenceSuccess",
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

export function createAutoMergeExecutionPackage(baseCommit, plan) {
  return {
    ...createAcceptedAutoMergePackage(baseCommit),
    currentWorkStage: "auto-merge-execution",
    artifacts: {
      ...createAcceptedAutoMergePackage(baseCommit).artifacts,
      autoMergePlan: {
        artifactId: "autoMergePlan",
        body: plan,
        appendedAt: "2026-05-19T10:00:00.000Z",
      },
    },
  };
}
