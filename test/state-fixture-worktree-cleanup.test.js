import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createFixtureWorktree } from "../src/workflow/state-fixture-worktree-create.js";
import { removeExistingStubWorktrees } from "../src/workflow/state-fixture-worktree-cleanup.js";
import {
  createManagedTestRepository,
  fixtureGitSucceeds,
} from "./support/state-fixture-git-fixtures.js";

test("fixture worktree cleanup removes existing stub branches and directories", async (t) => {
  const repositoryDir = await createManagedTestRepository(t);
  await createFixtureWorktree({
    repositoryDir,
    id: "stub-convergence-failure",
  });

  assert.equal(removeExistingStubWorktrees(repositoryDir), 1);
  assert.equal(
    existsSync(join(repositoryDir, ".workflow", "worktrees", "tasks", "stub-convergence-failure")),
    false,
  );
  assert.equal(
    fixtureGitSucceeds(["show-ref", "--verify", "--quiet", "refs/heads/workflow/tasks/stub-convergence-failure"], repositoryDir),
    false,
  );
});
