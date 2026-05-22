import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cloneJsonValue } from "./json-value.js";

export function packageFileName(packageId) {
  const safePackageId = String(packageId ?? "")
    .replace(/^task-context-package:/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safePackageId || "unknown-package"}.json`;
}

function isTransientReadError(error) {
  return error?.code === "EPERM" || error?.code === "EBUSY";
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readPackageFile(path, {
  readFileImpl = readFile,
  retryDelayMs = 25,
  maxTransientAttempts = 3,
} = {}) {
  for (let attempt = 1; attempt <= maxTransientAttempts; attempt += 1) {
    try {
      return await readFileImpl(path, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      if (!isTransientReadError(error) || attempt === maxTransientAttempts) {
        throw error;
      }
      await wait(retryDelayMs);
    }
  }
  return null;
}

export async function loadTaskContextPackages({
  storeDir,
  readFileImpl = readFile,
  retryDelayMs,
} = {}) {
  let entries;
  try {
    entries = await readdir(storeDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const packages = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const rawText = await readPackageFile(join(storeDir, entry.name), {
      readFileImpl,
      retryDelayMs,
    });
    if (rawText === null) continue;
    const taskContextPackage = JSON.parse(rawText);
    if (taskContextPackage?.packageId) {
      packages.push(taskContextPackage);
    }
  }
  return packages;
}

export async function saveTaskContextPackage({ storeDir, taskContextPackage }) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  await mkdir(storeDir, { recursive: true });
  const targetPath = join(storeDir, packageFileName(taskContextPackage.packageId));
  const temporaryPath = `${targetPath}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(cloneJsonValue(taskContextPackage), null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, targetPath);
  return targetPath;
}
