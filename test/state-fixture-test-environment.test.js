import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertTestEnvironment,
  ensureTestEnvironmentGitignore,
  TEST_ENV_GITIGNORE,
} from "../src/workflow/state-fixture-test-environment.js";
import {
  createManagedTestRepository,
  runFixtureGit,
} from "./support/state-fixture-git-fixtures.js";

test("test environment guard accepts only the managed repository path", async (t) => {
  const repositoryDir = await createManagedTestRepository(t);
  assert.doesNotThrow(() => assertTestEnvironment(repositoryDir));

  const outsideDir = await mkdtemp(join(tmpdir(), "simple-workflow-real-repo-"));
  t.after(() => rm(outsideDir, { recursive: true, force: true }));
  assert.throws(
    () => assertTestEnvironment(outsideDir),
    /测试状态种子只能写入/,
  );
});

test("gitignore setup is a no-op outside git and commits managed fixture ignores inside git", async (t) => {
  const nonGitDir = await mkdtemp(join(tmpdir(), "simple-workflow-non-git-fixture-"));
  t.after(() => rm(nonGitDir, { recursive: true, force: true }));
  await ensureTestEnvironmentGitignore(nonGitDir);
  assert.equal(existsSync(join(nonGitDir, ".gitignore")), false);

  const repositoryDir = await createManagedTestRepository(t);
  const previousHead = runFixtureGit(["rev-parse", "HEAD"], repositoryDir);

  await ensureTestEnvironmentGitignore(repositoryDir);

  assert.equal(await readFile(join(repositoryDir, ".gitignore"), "utf8"), TEST_ENV_GITIGNORE);
  assert.notEqual(runFixtureGit(["rev-parse", "HEAD"], repositoryDir), previousHead);
  assert.equal(runFixtureGit(["status", "--porcelain"], repositoryDir), "");
});
