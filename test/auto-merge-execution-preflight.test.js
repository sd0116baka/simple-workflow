import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAutoMergeExecutionPreflight } from "../src/workflow/auto-merge-execution-preflight.js";

function packageReadyForExecution({
  planWorktreePath = ".workflow/worktrees/tasks/tasks-task-003",
  isolatedWorktreePath = ".workflow/worktrees/tasks/tasks-task-003",
} = {}) {
  const planSource = {
    branchName: "workflow/tasks/tasks-task-003",
    baseCommit: "base-commit",
    currentCommit: "source-commit",
  };
  if (planWorktreePath !== undefined) {
    planSource.worktreePath = planWorktreePath;
  }

  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    currentWorkStage: "auto-merge-execution",
    artifacts: {
      isolatedWorkspace: {
        artifactId: "isolatedWorkspace",
        body: {
          worktreePath: isolatedWorktreePath,
          branchName: "workflow/tasks/tasks-task-003",
          baseBranch: "main",
          baseCommit: "base-commit",
          status: "ready",
        },
      },
      humanDecision: {
        artifactId: "humanDecision",
        body: {
          decision: "accept-convergence",
        },
      },
      autoMergePlan: {
        artifactId: "autoMergePlan",
        body: {
          plannedAt: "2026-05-19T10:00:00.000Z",
          decisionRef: "humanDecision",
          source: planSource,
          target: {
            branchName: "main",
            currentCommit: "target-commit",
          },
          changeSet: {
            changedFiles: ["result.txt"],
          },
        },
      },
    },
  };
}

function createGit(overrides = {}) {
  return {
    resolveWorktreePath: (worktreePath, repositoryDir) => `${repositoryDir}/${worktreePath}`,
    runGit: (args) => {
      if (args[0] === "branch") return "main";
      if (args[0] === "rev-parse") return "target-commit";
      return "";
    },
    repositoryChangedFiles: () => [],
    changedFilesInWorktree: () => ["result.txt"],
    ...overrides,
  };
}

test("returns execution preflight inputs for a clean planned merge", () => {
  const result = resolveAutoMergeExecutionPreflight({
    taskContextPackage: packageReadyForExecution(),
    repositoryDir: "repo",
    fsExists: () => true,
    git: createGit(),
  });

  assert.deepEqual(result.reasons, []);
  assert.equal(result.preflight.plan.target.branchName, "main");
  assert.equal(result.preflight.worktreePath, ".workflow/worktrees/tasks/tasks-task-003");
  assert.equal(
    result.preflight.absoluteWorktreePath,
    "repo/.workflow/worktrees/tasks/tasks-task-003",
  );
  assert.equal(result.preflight.targetCommit, "target-commit");
  assert.deepEqual(result.preflight.worktreeChangedFiles, ["result.txt"]);
});

test("falls back to isolated workspace path when the plan omits source worktree path", () => {
  const result = resolveAutoMergeExecutionPreflight({
    taskContextPackage: packageReadyForExecution({
      planWorktreePath: null,
      isolatedWorktreePath: ".workflow/worktrees/fallback",
    }),
    repositoryDir: "repo",
    fsExists: () => true,
    git: createGit(),
  });

  assert.deepEqual(result.reasons, []);
  assert.equal(result.preflight.worktreePath, ".workflow/worktrees/fallback");
  assert.equal(result.preflight.absoluteWorktreePath, "repo/.workflow/worktrees/fallback");
});

test("rejects execution preflight when the worktree is missing", () => {
  const result = resolveAutoMergeExecutionPreflight({
    taskContextPackage: packageReadyForExecution(),
    repositoryDir: "repo",
    fsExists: () => false,
    git: createGit({
      runGit: () => {
        throw new Error("git should not run for a missing worktree");
      },
    }),
  });

  assert.equal(result.preflight, null);
  assert.deepEqual(result.reasons, [
    {
      code: "WORKTREE_MISSING",
      message: "隔离工作树不存在。",
    },
  ]);
});

test("rejects execution preflight when Git probes fail", () => {
  const result = resolveAutoMergeExecutionPreflight({
    taskContextPackage: packageReadyForExecution(),
    repositoryDir: "repo",
    fsExists: () => true,
    git: createGit({
      repositoryChangedFiles: () => {
        throw new Error("status failed");
      },
    }),
  });

  assert.equal(result.preflight, null);
  assert.deepEqual(result.reasons, [
    {
      code: "GIT_CHECK_FAILED",
      message: "status failed",
    },
  ]);
});

test("rejects execution preflight when target branch is not checked out", () => {
  const result = resolveAutoMergeExecutionPreflight({
    taskContextPackage: packageReadyForExecution(),
    repositoryDir: "repo",
    fsExists: () => true,
    git: createGit({
      runGit: (args) => {
        if (args[0] === "branch") return "feature";
        if (args[0] === "rev-parse") return "target-commit";
        return "";
      },
    }),
  });

  assert.equal(result.preflight, null);
  assert.deepEqual(result.reasons, [
    {
      code: "TARGET_NOT_CHECKED_OUT",
      message: "目标分支不是主工作树当前分支。",
    },
  ]);
});

test("rejects execution preflight when the target branch moved", () => {
  const result = resolveAutoMergeExecutionPreflight({
    taskContextPackage: packageReadyForExecution(),
    repositoryDir: "repo",
    fsExists: () => true,
    git: createGit({
      runGit: (args) => {
        if (args[0] === "branch") return "main";
        if (args[0] === "rev-parse") return "new-target-commit";
        return "";
      },
    }),
  });

  assert.equal(result.preflight, null);
  assert.deepEqual(result.reasons, [
    {
      code: "TARGET_MOVED",
      message: "目标分支已经不在自动合并计划记录的 commit。",
    },
  ]);
});

test("rejects execution preflight when the main worktree is dirty", () => {
  const result = resolveAutoMergeExecutionPreflight({
    taskContextPackage: packageReadyForExecution(),
    repositoryDir: "repo",
    fsExists: () => true,
    git: createGit({
      repositoryChangedFiles: () => ["dirty.txt"],
    }),
  });

  assert.equal(result.preflight, null);
  assert.deepEqual(result.reasons, [
    {
      code: "MAIN_WORKTREE_DIRTY",
      message: "主工作区存在未提交变更。",
    },
  ]);
});
