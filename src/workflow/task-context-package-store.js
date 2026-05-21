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

export async function loadTaskContextPackages({ storeDir }) {
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
    const rawText = await readFile(join(storeDir, entry.name), "utf8");
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
