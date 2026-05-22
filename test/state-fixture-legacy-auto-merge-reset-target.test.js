import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findLegacyAutoMergeResetTarget } from "../src/workflow/state-fixture-legacy-auto-merge-reset-target.js";
import {
  createManagedTestRepository,
  runFixtureGit,
} from "./support/state-fixture-git-fixtures.js";

async function commitFile(repositoryDir, fileName, content, subject) {
  await writeFile(join(repositoryDir, fileName), content, "utf8");
  runFixtureGit(["add", fileName], repositoryDir);
  runFixtureGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    subject,
  ], repositoryDir);
}

test("legacy auto merge reset target returns the commit before top stub auto-merge commits", async (t) => {
  const repositoryDir = await createManagedTestRepository(t);
  const baseCommit = runFixtureGit(["rev-parse", "HEAD"], repositoryDir);

  await commitFile(repositoryDir, "first-stub.txt", "first\n", "chore(auto-merge): stub-first");
  await commitFile(repositoryDir, "second-stub.txt", "second\n", "chore(auto-merge): stub-second");

  assert.equal(findLegacyAutoMergeResetTarget(repositoryDir), baseCommit);
});

test("legacy auto merge reset target ignores repositories without top stub auto-merge commits", async (t) => {
  const repositoryDir = await createManagedTestRepository(t);

  await commitFile(repositoryDir, "regular.txt", "regular\n", "regular commit");

  assert.equal(findLegacyAutoMergeResetTarget(repositoryDir), null);
});
