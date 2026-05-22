import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createFixtureWorktree } from "../src/workflow/state-fixture-worktree-create.js";
import {
  createManagedTestRepository,
  fixtureGitSucceeds,
  runFixtureGit,
} from "./support/state-fixture-git-fixtures.js";

test("fixture worktree creation creates stub branch and marker file", async (t) => {
  const repositoryDir = await createManagedTestRepository(t);
  const resources = await createFixtureWorktree({
    repositoryDir,
    id: "stub-convergence-failure",
  });

  assert.equal(resources.branchName, "workflow/tasks/stub-convergence-failure");
  assert.equal(resources.worktreePath, ".workflow/worktrees/tasks/stub-convergence-failure");
  assert.equal(runFixtureGit(["rev-parse", "main"], repositoryDir), resources.baseCommit);
  assert.equal(
    existsSync(join(repositoryDir, ".workflow", "worktrees", "tasks", "stub-convergence-failure", "fixtures", "stub-convergence-failure.txt")),
    true,
  );
  assert.equal(
    fixtureGitSucceeds(["show-ref", "--verify", "--quiet", "refs/heads/workflow/tasks/stub-convergence-failure"], repositoryDir),
    true,
  );
});
