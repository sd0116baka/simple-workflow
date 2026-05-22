import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAutoMergePlanningInputs } from "../src/workflow/auto-merge-planning-inputs.js";

function acceptedPackage({ baseCommit = "base-commit" } = {}) {
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
      },
      convergenceSuccess: {
        artifactId: "convergenceSuccess",
        body: {
          summary: "stub task completed",
        },
      },
      humanDecision: {
        artifactId: "humanDecision",
        body: {
          decision: "accept-convergence",
          acceptedWork: {
            isolatedWorkspaceRef: "isolatedWorkspace",
            worktreePath: ".workflow/worktrees/tasks/tasks-task-003",
            branchName: "workflow/tasks/tasks-task-003",
            baseCommit,
          },
        },
      },
    },
  };
}

function createGit(overrides = {}) {
  return {
    resolveWorktreePath: (worktreePath, repositoryDir) => `${repositoryDir}/${worktreePath}`,
    runGit: (args) => (args[1] === "HEAD" ? "base-commit" : "target-commit"),
    changedFilesInWorktree: () => ["result.txt"],
    isAncestor: () => true,
    diffChangedFiles: () => ["committed-result.txt"],
    ...overrides,
  };
}

test("returns planning inputs from uncommitted accepted worktree changes", () => {
  const result = resolveAutoMergePlanningInputs({
    taskContextPackage: acceptedPackage(),
    repositoryDir: "repo",
    fsExists: () => true,
    git: createGit({
      diffChangedFiles: () => {
        throw new Error("diff should not be needed when worktree has changes");
      },
    }),
  });

  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.planningInputs, {
    source: {
      worktreePath: ".workflow/worktrees/tasks/tasks-task-003",
      branchName: "workflow/tasks/tasks-task-003",
      baseCommit: "base-commit",
      currentCommit: "base-commit",
    },
    target: {
      branchName: "main",
      currentCommit: "target-commit",
    },
    changedFiles: ["result.txt"],
    worktreeHeadMatchesAcceptedBase: true,
  });
});

test("returns planning inputs from committed diff when worktree has no uncommitted changes", () => {
  const result = resolveAutoMergePlanningInputs({
    taskContextPackage: acceptedPackage(),
    repositoryDir: "repo",
    targetBranch: "release",
    fsExists: () => true,
    git: createGit({
      runGit: (args) => (args[1] === "HEAD" ? "accepted-head" : "release-head"),
      changedFilesInWorktree: () => [],
      diffChangedFiles: (baseCommit, headCommit) => {
        assert.equal(baseCommit, "base-commit");
        assert.equal(headCommit, "accepted-head");
        return ["committed-result.txt"];
      },
    }),
  });

  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.planningInputs.target, {
    branchName: "release",
    currentCommit: "release-head",
  });
  assert.deepEqual(result.planningInputs.changedFiles, ["committed-result.txt"]);
  assert.equal(result.planningInputs.source.currentCommit, "accepted-head");
  assert.equal(result.planningInputs.worktreeHeadMatchesAcceptedBase, false);
});

test("rejects planning inputs when accepted worktree is missing", () => {
  const result = resolveAutoMergePlanningInputs({
    taskContextPackage: acceptedPackage(),
    repositoryDir: "repo",
    fsExists: () => false,
    git: createGit({
      runGit: () => {
        throw new Error("git should not run for a missing worktree");
      },
    }),
  });

  assert.equal(result.planningInputs, null);
  assert.deepEqual(result.reasons, [
    {
      code: "WORKTREE_MISSING",
      message: "隔离工作树不存在。",
    },
  ]);
});

test("rejects planning inputs when worktree head does not contain accepted base", () => {
  const result = resolveAutoMergePlanningInputs({
    taskContextPackage: acceptedPackage(),
    repositoryDir: "repo",
    fsExists: () => true,
    git: createGit({
      runGit: (args) => (args[1] === "HEAD" ? "other-head" : "target-commit"),
      isAncestor: () => false,
    }),
  });

  assert.equal(result.planningInputs, null);
  assert.deepEqual(result.reasons, [
    {
      code: "WORKTREE_HEAD_MISMATCH",
      message: "隔离工作树 HEAD 不包含人工接受时的 baseCommit。",
    },
  ]);
});

test("rejects planning inputs when neither worktree nor committed diff has changes", () => {
  const result = resolveAutoMergePlanningInputs({
    taskContextPackage: acceptedPackage(),
    repositoryDir: "repo",
    fsExists: () => true,
    git: createGit({
      changedFilesInWorktree: () => [],
    }),
  });

  assert.equal(result.planningInputs, null);
  assert.deepEqual(result.reasons, [
    {
      code: "NO_CHANGES",
      message: "隔离工作树没有可合并变更。",
    },
  ]);
});

test("rejects planning inputs when Git probes fail", () => {
  const result = resolveAutoMergePlanningInputs({
    taskContextPackage: acceptedPackage(),
    repositoryDir: "repo",
    fsExists: () => true,
    git: createGit({
      changedFilesInWorktree: () => {
        throw new Error("status failed");
      },
    }),
  });

  assert.equal(result.planningInputs, null);
  assert.deepEqual(result.reasons, [
    {
      code: "GIT_CHECK_FAILED",
      message: "status failed",
    },
  ]);
});
