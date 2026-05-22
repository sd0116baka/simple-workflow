import { loadTaskContextPackages } from "./task-context-package-store.js";
import { isStubPackage } from "./state-fixture-paths.js";
import { selectEarliestExistingCommit } from "./state-fixture-git-commit-selection.js";

export async function findPackageResetTarget({ repositoryDir, storeDir }) {
  const packages = await loadTaskContextPackages({ storeDir });
  return selectEarliestExistingCommit({
    repositoryDir,
    commits: packages
      .filter(isStubPackage)
      .map((taskContextPackage) => taskContextPackage.fixture?.baseCommit),
  });
}
