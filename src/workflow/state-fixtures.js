import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  saveTaskContextPackage,
} from "./task-context-package-store.js";
import {
  buildFixtureTaskContextPackage,
} from "./state-fixture-packages.js";
import {
  STAGE_FIXTURES,
  yamlForFixture,
} from "./state-fixture-catalog.js";
import { needsFixtureWorktree } from "./state-fixture-paths.js";
import {
  resetManagedStateFixtureEnvironment,
} from "./state-fixture-test-environment.js";
import { createFixtureWorktree } from "./state-fixture-worktree-create.js";

export async function seedTestStateFixtures({
  repositoryDir,
  tasksDir,
  storeDir,
  fixtureKey,
  now = () => new Date().toISOString(),
} = {}) {
  if (!repositoryDir || !tasksDir || !storeDir) {
    throw new Error("repositoryDir, tasksDir and storeDir are required");
  }
  await resetManagedStateFixtureEnvironment({ repositoryDir, tasksDir, storeDir });

  const timestamp = now();
  const fixture = STAGE_FIXTURES.find((item) => item.fixtureKey === fixtureKey)
    ?? STAGE_FIXTURES[0];
  const fixtureResources = needsFixtureWorktree(fixture)
    ? await createFixtureWorktree({ repositoryDir, id: fixture.id })
    : {};
  const runtimeFixture = {
    ...fixture,
    baseCommit: fixtureResources.baseCommit,
  };
  const fileName = `${fixture.id}.yaml`;
  await writeFile(join(tasksDir, fileName), yamlForFixture(runtimeFixture), "utf8");
  const taskPackage = buildFixtureTaskContextPackage({
    fixture: runtimeFixture,
    timestamp,
    baseCommit: runtimeFixture.baseCommit,
  });
  await saveTaskContextPackage({
    storeDir,
    taskContextPackage: taskPackage,
  });

  return {
    generatedAt: timestamp,
    count: 1,
    tasks: [
      {
        packageId: taskPackage.packageId,
        sourcePath: taskPackage.source.path,
        currentWorkStage: taskPackage.currentWorkStage,
      },
    ],
  };
}

export async function cleanupTestStateFixtures({
  repositoryDir,
  tasksDir,
  storeDir,
} = {}) {
  if (!repositoryDir || !tasksDir || !storeDir) {
    throw new Error("repositoryDir, tasksDir and storeDir are required");
  }
  return resetManagedStateFixtureEnvironment({ repositoryDir, tasksDir, storeDir });
}
