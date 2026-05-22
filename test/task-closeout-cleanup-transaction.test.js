import { test } from "node:test";
import assert from "node:assert/strict";
import { removeWorkspaceAndBranch } from "../src/workflow/task-closeout-cleanup-transaction.js";

function createCleanupAdapters({
  absoluteWorktreePath = "repo/.workflow/worktrees/task",
  worktreeExists = true,
  registeredWorktree = true,
  branchExistsBefore = true,
  branchExistsAfter = false,
  insideWorktreeRoot = true,
} = {}) {
  const commands = [];
  const removedPaths = [];
  const branchChecks = [branchExistsBefore, branchExistsAfter];
  let currentWorktreeExists = worktreeExists;
  return {
    commands,
    removedPaths,
    filesystem: {
      existsSync: (path) => path === absoluteWorktreePath && currentWorktreeExists,
      rmSync: (path, options) => {
        removedPaths.push({ path, options });
        currentWorktreeExists = false;
      },
    },
    git: {
      resolveWorktreePath: (worktreePath, repositoryDir) => {
        if (!worktreePath) return null;
        return `${repositoryDir}/${worktreePath}`;
      },
      listedWorktreePaths: () => (registeredWorktree ? [absoluteWorktreePath] : []),
      isPathInside: () => insideWorktreeRoot,
      runGit: (args, { cwd }) => {
        commands.push({ args, cwd });
        if (args[0] === "worktree" && args[1] === "remove") {
          currentWorktreeExists = false;
        }
      },
      gitSucceeds: () => branchChecks.shift() ?? false,
    },
    pathResolve: (...parts) => parts.join("/"),
  };
}

test("removes a registered worktree and branch", () => {
  const adapters = createCleanupAdapters();

  const result = removeWorkspaceAndBranch({
    repositoryDir: "repo",
    worktreePath: ".workflow/worktrees/task",
    branchName: "workflow/task",
    filesystem: adapters.filesystem,
    git: adapters.git,
    pathResolve: adapters.pathResolve,
  });

  assert.deepEqual(result, { error: null });
  assert.deepEqual(
    adapters.commands.map((command) => command.args),
    [
      ["worktree", "remove", "--force", "repo/.workflow/worktrees/task"],
      ["worktree", "prune"],
      ["branch", "-D", "workflow/task"],
    ],
  );
  assert.deepEqual(adapters.removedPaths, []);
});

test("removes a residual unregistered worktree directory under managed worktrees", () => {
  const adapters = createCleanupAdapters({
    registeredWorktree: false,
  });

  const result = removeWorkspaceAndBranch({
    repositoryDir: "repo",
    worktreePath: ".workflow/worktrees/task",
    branchName: "workflow/task",
    filesystem: adapters.filesystem,
    git: adapters.git,
    pathResolve: adapters.pathResolve,
  });

  assert.deepEqual(result, { error: null });
  assert.deepEqual(adapters.removedPaths, [
    {
      path: "repo/.workflow/worktrees/task",
      options: { recursive: true, force: true },
    },
  ]);
});

test("rejects an empty worktree path", () => {
  const adapters = createCleanupAdapters();

  const result = removeWorkspaceAndBranch({
    repositoryDir: "repo",
    worktreePath: "",
    branchName: "workflow/task",
    filesystem: adapters.filesystem,
    git: adapters.git,
    pathResolve: adapters.pathResolve,
  });

  assert.deepEqual(result, {
    error: "隔离工作树路径为空，不能收尾。",
  });
  assert.deepEqual(adapters.commands, []);
});

test("rejects residual directories outside the managed worktree root", () => {
  const adapters = createCleanupAdapters({
    registeredWorktree: false,
    insideWorktreeRoot: false,
  });

  const result = removeWorkspaceAndBranch({
    repositoryDir: "repo",
    worktreePath: ".workflow/worktrees/task",
    branchName: "workflow/task",
    filesystem: adapters.filesystem,
    git: adapters.git,
    pathResolve: adapters.pathResolve,
  });

  assert.deepEqual(result, {
    error: "残留目录不在 .workflow/worktrees 下，不能自动删除。",
  });
  assert.deepEqual(adapters.removedPaths, []);
});

test("reports cleanup failure when worktree or branch still exists", () => {
  const adapters = createCleanupAdapters({
    branchExistsAfter: true,
  });

  const result = removeWorkspaceAndBranch({
    repositoryDir: "repo",
    worktreePath: ".workflow/worktrees/task",
    branchName: "workflow/task",
    filesystem: adapters.filesystem,
    git: adapters.git,
    pathResolve: adapters.pathResolve,
  });

  assert.deepEqual(result, {
    error: "执行侧资源未清理干净，不能完成取消或收尾。",
  });
});
