import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

async function listDirectoryEntries(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function removeMatchingFiles({ directory, matches }) {
  const entries = await listDirectoryEntries(directory);
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !matches(entry.name)) continue;
    await rm(join(directory, entry.name), { force: true });
    removed += 1;
  }
  return removed;
}

export async function cleanupStateFixtureStorage({ tasksDir, storeDir } = {}) {
  if (!tasksDir || !storeDir) {
    throw new Error("tasksDir and storeDir are required");
  }

  const removedTaskFiles = await removeMatchingFiles({
    directory: tasksDir,
    matches: (fileName) => /^stub-.*\.ya?ml$/i.test(fileName),
  });
  const removedPackages = await removeMatchingFiles({
    directory: storeDir,
    matches: (fileName) => /^tasks-stub-.*\.ya?ml\.json$/i.test(fileName),
  });

  return {
    removedTaskFiles,
    removedPackages,
  };
}
