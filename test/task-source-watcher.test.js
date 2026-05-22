import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTaskSourceWatcher } from "../src/workflow/task-source-watcher.js";

test("task source watcher debounces supported task file changes", async () => {
  const events = [];
  let handler = null;
  let watchCount = 0;
  let closed = false;
  const watcher = createTaskSourceWatcher({
    tasksDir: "tasks",
    watchDebounceMs: 5,
    onTaskChange: (event) => events.push(event),
    createWatcher: (tasksDir, callback) => {
      watchCount += 1;
      handler = callback;
      assert.equal(tasksDir, "tasks");
      return {
        close() {
          closed = true;
        },
      };
    },
    ensureDirectory: async (tasksDir, options) => {
      assert.equal(tasksDir, "tasks");
      assert.deepEqual(options, { recursive: true });
    },
    supportsTaskFile: (fileName) => String(fileName).endsWith(".yaml"),
  });

  await watcher.start();
  await watcher.start();
  handler("change", "ignored.txt");
  handler("rename", "task-001.yaml");
  handler("change", "task-002.yaml");
  await delay(20);
  watcher.stop();

  assert.equal(watchCount, 1);
  assert.equal(closed, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "change");
  assert.equal(events[0].fileName, "task-002.yaml");
  assert.equal(events[0].type, undefined);
  assert.match(events[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
