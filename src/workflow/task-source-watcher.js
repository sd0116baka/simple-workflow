import { watch } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { isSupportedTaskFile } from "./task-source.js";

export function createTaskSourceWatcher({
  tasksDir,
  watchDebounceMs = 100,
  onTaskChange,
  createWatcher = watch,
  ensureDirectory = mkdir,
  readDirectory = readdir,
  readFileStat = stat,
  supportsTaskFile = isSupportedTaskFile,
  setPollInterval = setInterval,
  clearPollInterval = clearInterval,
  pollIntervalMs = Math.max(25, watchDebounceMs * 2),
}) {
  let watcher = null;
  let debounceTimer = null;
  let pollTimer = null;
  let knownFiles = new Map();

  function emitTaskChange(eventType, fileName) {
    onTaskChange({
      eventType,
      fileName: String(fileName),
      timestamp: new Date().toISOString(),
    });
  }

  function scheduleTaskChange(eventType, fileName) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      emitTaskChange(eventType, fileName);
    }, watchDebounceMs);
  }

  async function snapshotTaskFiles() {
    let entries;
    try {
      entries = await readDirectory(tasksDir, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return new Map();
      throw error;
    }

    const snapshot = new Map();
    await Promise.all(entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => supportsTaskFile(fileName))
      .map(async (fileName) => {
        const fileStat = await readFileStat(join(tasksDir, fileName));
        snapshot.set(fileName, `${fileStat.mtimeMs}:${fileStat.size}`);
      }));
    return snapshot;
  }

  function emitSnapshotChanges(nextFiles) {
    for (const [fileName, signature] of nextFiles) {
      if (knownFiles.get(fileName) !== signature) {
        scheduleTaskChange("change", fileName);
      }
    }

    for (const fileName of knownFiles.keys()) {
      if (!nextFiles.has(fileName)) {
        scheduleTaskChange("rename", fileName);
      }
    }

    knownFiles = nextFiles;
  }

  async function pollTaskFiles() {
    emitSnapshotChanges(await snapshotTaskFiles());
  }

  return {
    async start() {
      if (watcher) return;
      await ensureDirectory(tasksDir, { recursive: true });
      knownFiles = await snapshotTaskFiles();
      watcher = createWatcher(tasksDir, (eventType, fileName) => {
        if (!supportsTaskFile(fileName)) return;
        scheduleTaskChange(eventType, fileName);
      });
      pollTimer = setPollInterval(() => {
        pollTaskFiles().catch(() => {});
      }, pollIntervalMs);
      pollTimer.unref?.();
    },

    stop() {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      clearPollInterval(pollTimer);
      pollTimer = null;
      watcher?.close();
      watcher = null;
      knownFiles = new Map();
    },
  };
}
