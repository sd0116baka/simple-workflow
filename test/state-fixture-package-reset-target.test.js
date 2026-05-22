import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { saveTaskContextPackage } from "../src/workflow/task-context-package-store.js";
import { findPackageResetTarget } from "../src/workflow/state-fixture-package-reset-target.js";
import {
  createManagedTestRepository,
  runFixtureGit,
} from "./support/state-fixture-git-fixtures.js";
import { buildStateFixturePackage } from "./support/state-fixture-package-fixtures.js";

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
  return runFixtureGit(["rev-parse", "HEAD"], repositoryDir);
}

test("package reset target selects the earliest valid stub fixture base commit", async (t) => {
  const repositoryDir = await createManagedTestRepository(t);
  const storeDir = join(repositoryDir, ".workflow", "task-context-packages");
  const firstCommit = runFixtureGit(["rev-parse", "HEAD"], repositoryDir);
  const secondCommit = await commitFile(repositoryDir, "second.txt", "second\n", "second commit");
  const thirdCommit = await commitFile(repositoryDir, "third.txt", "third\n", "third commit");

  await saveTaskContextPackage({
    storeDir,
    taskContextPackage: buildStateFixturePackage({
      fixtureKey: "convergence",
      baseCommit: thirdCommit,
    }),
  });
  await saveTaskContextPackage({
    storeDir,
    taskContextPackage: buildStateFixturePackage({
      fixtureKey: "review-agent",
      baseCommit: firstCommit,
    }),
  });
  await saveTaskContextPackage({
    storeDir,
    taskContextPackage: buildStateFixturePackage({
      fixtureKey: "execution-agent",
      baseCommit: "not-a-commit",
    }),
  });
  await saveTaskContextPackage({
    storeDir,
    taskContextPackage: {
      packageId: "task-context-package:tasks/regular.yaml",
      source: { path: "tasks/regular.yaml" },
      fixture: { baseCommit: secondCommit },
    },
  });

  assert.equal(await findPackageResetTarget({ repositoryDir, storeDir }), firstCommit);
});

test("package reset target returns null when no valid stub package commit exists", async (t) => {
  const repositoryDir = await createManagedTestRepository(t);
  const storeDir = join(repositoryDir, ".workflow", "task-context-packages");

  await saveTaskContextPackage({
    storeDir,
    taskContextPackage: {
      packageId: "task-context-package:tasks/regular.yaml",
      source: { path: "tasks/regular.yaml" },
      fixture: { baseCommit: runFixtureGit(["rev-parse", "HEAD"], repositoryDir) },
    },
  });

  assert.equal(await findPackageResetTarget({ repositoryDir, storeDir }), null);
});
