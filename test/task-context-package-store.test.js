import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("loading packages skips files that disappear during fixture cleanup", async (t) => {
  const storeDir = await mkdtemp(join(tmpdir(), "simple-workflow-package-store-disappearing-"));
  t.after(() => rm(storeDir, { recursive: true, force: true }));
  const packagePath = join(storeDir, packageFileName("task-context-package:tasks/stub-closed.yaml"));
  await writeFile(packagePath, "{}", "utf8");

  const loadedPackages = await loadTaskContextPackages({
    storeDir,
    async readFileImpl() {
      const error = new Error("removed by concurrent cleanup");
      error.code = "ENOENT";
      throw error;
    },
  });

  assert.deepEqual(loadedPackages, []);
});

test("loading packages retries transient file lock errors", async (t) => {
  const storeDir = await mkdtemp(join(tmpdir(), "simple-workflow-package-store-locked-"));
  t.after(() => rm(storeDir, { recursive: true, force: true }));
  const taskContextPackage = {
    packageId: "task-context-package:tasks/stub-closed.yaml",
    currentWorkStage: "closed",
  };
  const packagePath = join(storeDir, packageFileName(taskContextPackage.packageId));
  await writeFile(packagePath, `${JSON.stringify(taskContextPackage)}\n`, "utf8");
  let attempts = 0;

  const loadedPackages = await loadTaskContextPackages({
    storeDir,
    retryDelayMs: 0,
    async readFileImpl(path, encoding) {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error("temporarily locked");
        error.code = "EPERM";
        throw error;
      }
      return readFile(path, encoding);
    },
  });

  assert.equal(attempts, 2);
  assert.deepEqual(loadedPackages, [taskContextPackage]);
});
