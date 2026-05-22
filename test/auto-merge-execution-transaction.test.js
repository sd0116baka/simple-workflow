import { test } from "node:test";
import assert from "node:assert/strict";
import { runAutoMergeExecutionTransaction } from "../src/workflow/auto-merge-execution-transaction.js";

function taskContextPackage() {
  return {
    packageId: "task-context-package:tasks/task-003.yaml",
    taskDraft: {
      id: "tasks/task-003",
      name: "测试任务",
    },
  };
}

function autoMergePlan({ baseCommit = "base-commit" } = {}) {
  return {
    source: {
      branchName: "workflow/tasks/tasks-task-003",
      baseCommit,
    },
    target: {
      branchName: "main",
      currentCommit: "target-commit",
    },
  };
}

function createGit({
  revParseHeads = ["base-commit", "source-commit"],
  stagedFiles = ["result.txt"],
  ancestor = true,
  diffFiles = ["committed-result.txt"],
  failOnCommand = null,
} = {}) {
  const commands = [];
  const headQueue = [...revParseHeads];
  const git = {
    commands,
    runGit: (args, { cwd }) => {
      commands.push({ args, cwd });
      if (failOnCommand?.(args, cwd)) {
        throw new Error("merge failed");
      }
      if (args[0] === "rev-parse" && args[1] === "HEAD") {
        return headQueue.shift() ?? revParseHeads.at(-1);
      }
      if (args[0] === "rev-parse" && args[1] === "main") {
        return "after-commit";
      }
      return "";
    },
    stagedChangedFiles: () => stagedFiles,
    isAncestor: () => ancestor,
    diffChangedFiles: () => diffFiles,
  };
  return git;
}

test("commits uncommitted worktree changes and fast-forwards the target", () => {
  const git = createGit();

  const result = runAutoMergeExecutionTransaction({
    taskContextPackage: taskContextPackage(),
    repositoryDir: "repo",
    plan: autoMergePlan(),
    absoluteWorktreePath: "repo/.workflow/worktrees/task",
    targetCommit: "target-commit",
    worktreeChangedFiles: ["result.txt"],
    git,
  });

  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.transaction, {
    sourceCommit: "source-commit",
    afterCommit: "after-commit",
    mergedChangedFiles: ["result.txt"],
    sourceRebased: false,
  });
  assert.deepEqual(
    git.commands.map((command) => command.args),
    [
      ["rev-parse", "HEAD"],
      ["add", "-A"],
      [
        "-c",
        "user.name=Simple Workflow",
        "-c",
        "user.email=simple-workflow@example.invalid",
        "commit",
        "-m",
        "chore(auto-merge): tasks/task-003 测试任务",
      ],
      ["rev-parse", "HEAD"],
      ["merge", "--ff-only", "source-commit"],
      ["rev-parse", "main"],
    ],
  );
});

test("uses committed diff when the accepted worktree has no uncommitted changes", () => {
  const git = createGit({
    revParseHeads: ["source-commit"],
    diffFiles: ["already-committed.txt"],
  });

  const result = runAutoMergeExecutionTransaction({
    taskContextPackage: taskContextPackage(),
    repositoryDir: "repo",
    plan: autoMergePlan(),
    absoluteWorktreePath: "repo/.workflow/worktrees/task",
    targetCommit: "target-commit",
    worktreeChangedFiles: [],
    git,
  });

  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.transaction, {
    sourceCommit: "source-commit",
    afterCommit: "after-commit",
    mergedChangedFiles: ["already-committed.txt"],
    sourceRebased: false,
  });
});

test("rejects a stale execution with no worktree changes or source commit movement", () => {
  const git = createGit({
    revParseHeads: ["base-commit"],
  });

  const result = runAutoMergeExecutionTransaction({
    taskContextPackage: taskContextPackage(),
    repositoryDir: "repo",
    plan: autoMergePlan(),
    absoluteWorktreePath: "repo/.workflow/worktrees/task",
    targetCommit: "target-commit",
    worktreeChangedFiles: [],
    git,
  });

  assert.equal(result.transaction, null);
  assert.deepEqual(result.reasons, [
    {
      code: "NO_CHANGES",
      message: "隔离工作树没有可提交变更。",
    },
  ]);
});

test("rejects uncommitted worktree changes that produce no staged files", () => {
  const git = createGit({
    stagedFiles: [],
  });

  const result = runAutoMergeExecutionTransaction({
    taskContextPackage: taskContextPackage(),
    repositoryDir: "repo",
    plan: autoMergePlan(),
    absoluteWorktreePath: "repo/.workflow/worktrees/task",
    targetCommit: "target-commit",
    worktreeChangedFiles: ["result.txt"],
    git,
  });

  assert.equal(result.transaction, null);
  assert.deepEqual(result.reasons, [
    {
      code: "NO_STAGED_CHANGES",
      message: "隔离工作树没有可提交的暂存变更。",
    },
  ]);
});

test("rebases the source before fast-forward when target is not an ancestor", () => {
  const git = createGit({
    revParseHeads: ["base-commit", "source-commit", "rebased-source"],
    ancestor: false,
  });

  const result = runAutoMergeExecutionTransaction({
    taskContextPackage: taskContextPackage(),
    repositoryDir: "repo",
    plan: autoMergePlan(),
    absoluteWorktreePath: "repo/.workflow/worktrees/task",
    targetCommit: "target-commit",
    worktreeChangedFiles: ["result.txt"],
    git,
  });

  assert.deepEqual(result.reasons, []);
  assert.equal(result.transaction.sourceCommit, "rebased-source");
  assert.equal(result.transaction.sourceRebased, true);
  assert.deepEqual(
    git.commands.map((command) => command.args),
    [
      ["rev-parse", "HEAD"],
      ["add", "-A"],
      [
        "-c",
        "user.name=Simple Workflow",
        "-c",
        "user.email=simple-workflow@example.invalid",
        "commit",
        "-m",
        "chore(auto-merge): tasks/task-003 测试任务",
      ],
      ["rev-parse", "HEAD"],
      ["rebase", "target-commit"],
      ["rev-parse", "HEAD"],
      ["merge", "--ff-only", "rebased-source"],
      ["rev-parse", "main"],
    ],
  );
});

test("aborts rebase and reports auto merge failure when Git transaction fails", () => {
  const git = createGit({
    failOnCommand: (args) => args[0] === "merge",
  });

  const result = runAutoMergeExecutionTransaction({
    taskContextPackage: taskContextPackage(),
    repositoryDir: "repo",
    plan: autoMergePlan(),
    absoluteWorktreePath: "repo/.workflow/worktrees/task",
    targetCommit: "target-commit",
    worktreeChangedFiles: ["result.txt"],
    git,
  });

  assert.equal(result.transaction, null);
  assert.deepEqual(result.reasons, [
    {
      code: "AUTO_MERGE_FAILED",
      message: "merge failed",
    },
  ]);
  assert.deepEqual(git.commands.at(-1), {
    args: ["rebase", "--abort"],
    cwd: "repo/.workflow/worktrees/task",
  });
});
