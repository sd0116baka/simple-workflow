import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetMainToStubFixtureBase } from "../src/workflow/state-fixture-base-reset.js";
import { removeExistingStubWorktrees } from "../src/workflow/state-fixture-worktree-cleanup.js";

test("reset to stub fixture base is safe in a non git directory", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "simple-workflow-non-git-reset-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));

  assert.equal(await resetMainToStubFixtureBase({
    repositoryDir: rootDir,
    storeDir: join(rootDir, ".workflow", "task-context-packages"),
  }), null);
  assert.equal(removeExistingStubWorktrees(rootDir), 0);
});
