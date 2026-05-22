import { watch } from "node:fs";
import { mkdir } from "node:fs/promises";
import { isSupportedTaskFile } from "./task-source.js";

export function createTaskSourceWatcher({
  tasksDir,
  watchDebounceMs = 100,
  onTaskChange,
  createWatcher = watch,
  ensureDirectory = mkdir,
  supportsTaskFile = isSupportedTaskFile,
}) {
  let watcher = null;
  let debounceTimer = null;

  function emitTaskChange(eventType, fileName) {
    onTaskChange({
      eventType,
      fileName: String(fileName),
      timestamp: new Date().toISOString(),
    });
  }

  return {
    async start() {
      if (watcher) return;
      await ensureDirectory(tasksDir, { recursive: true });
      watcher = createWatcher(tasksDir, (eventType, fileName) => {
        if (!supportsTaskFile(fileName)) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          emitTaskChange(eventType, fileName);
        }, watchDebounceMs);
      });
    },

    stop() {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      watcher?.close();
      watcher = null;
    },
  };
}
