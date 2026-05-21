import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadTaskContextPackages,
  packageFileName,
  saveTaskContextPackage,
} from "../src/workflow/task-context-package-store.js";

test("builds safe package file names from package ids", () => {
  assert.equal(
    packageFileName("task-context-package:tasks/task-006-closeout-demo.yaml"),
    "tasks-task-006-closeout-demo.yaml.json",
  );
  assert.equal(
    packageFileName("task-context-package:../bad\\path:?*"),
    "..-bad-path.json",
  );
  assert.equal(packageFileName(""), "unknown-package.json");
});

test("saves and loads task context packages by package id", async (t) => {
  const storeDir = await mkdtemp(join(tmpdir(), "simple-workflow-package-store-"));
  t.after(() => rm(storeDir, { recursive: true, force: true }));
  const taskContextPackage = {
    packageId: "task-context-package:tasks/task-006-closeout-demo.yaml",
    currentWorkStage: "closed",
    artifacts: {
      taskCloseout: {
        artifactId: "taskCloseout",
        body: {
          finalStage: "closed",
        },
        appendedAt: "2026-05-19T00:00:00.000Z",
      },
    },
    agentRuns: [],
    timeline: [],
  };

  const savedPath = await saveTaskContextPackage({
    storeDir,
    taskContextPackage,
  });
  const savedText = await readFile(savedPath, "utf8");
  const loadedPackages = await loadTaskContextPackages({ storeDir });

  assert.equal(
    packageFileName(taskContextPackage.packageId),
    "tasks-task-006-closeout-demo.yaml.json",
  );
  assert.match(savedText, /"currentWorkStage": "closed"/);
  assert.deepEqual(loadedPackages, [taskContextPackage]);
});

test("loading packages from a missing store returns an empty list", async () => {
  const loadedPackages = await loadTaskContextPackages({
    storeDir: join(tmpdir(), "simple-workflow-missing-package-store"),
  });

  assert.deepEqual(loadedPackages, []);
});
