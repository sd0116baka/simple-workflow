import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAcceptedWorktreeSnapshot } from "../src/workflow/accepted-worktree-snapshot.js";

test("resolves accepted worktree snapshot from repository-relative cwd", () => {
  const result = resolveAcceptedWorktreeSnapshot({
    repositoryDir: "repo",
    worktreePath: ".workflow/worktrees/task",
    git: {
      resolveWorktreePath: (worktreePath, repositoryDir) => `${repositoryDir}/${worktreePath}`,
      changedFilesInWorktree: (cwd) => {
        assert.equal(cwd, "repo/.workflow/worktrees/task");
        return ["src/app.js"];
      },
    },
    pathRelative: (from, to) => {
      assert.equal(from, "repo");
      assert.equal(to, "repo/.workflow/worktrees/task");
      return ".workflow\\worktrees\\task";
    },
    normalizePath: (path) => path.replaceAll("\\", "/"),
  });

  assert.deepEqual(result, {
    worktreeSnapshot: {
      cwd: ".workflow/worktrees/task",
      changedFiles: ["src/app.js"],
    },
    error: null,
  });
});

test("rejects missing accepted worktree path", () => {
  const result = resolveAcceptedWorktreeSnapshot({
    repositoryDir: "repo",
    worktreePath: "",
    git: {
      resolveWorktreePath: () => null,
      changedFilesInWorktree: () => {
        throw new Error("should not read changed files");
      },
    },
  });

  assert.deepEqual(result, {
    worktreeSnapshot: null,
    error: "任务上下文包缺少隔离工作树路径，不能接受收敛成功。",
  });
});

test("reports worktree changed-file read failures", () => {
  const result = resolveAcceptedWorktreeSnapshot({
    repositoryDir: "repo",
    worktreePath: ".workflow/worktrees/task",
    git: {
      resolveWorktreePath: () => "repo/.workflow/worktrees/task",
      changedFilesInWorktree: () => {
        throw new Error("not a git worktree");
      },
    },
    pathRelative: () => ".workflow/worktrees/task",
  });

  assert.deepEqual(result, {
    worktreeSnapshot: null,
    error: "无法读取隔离工作树变更，不能接受收敛成功：not a git worktree",
  });
});
