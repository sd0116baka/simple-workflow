import { test } from "node:test";
import assert from "node:assert/strict";
import {
  taskContextPackageFromEntry,
  taskContextPackagesFromEntries,
} from "../src/workflow/task-context-package-build.js";
import { taskPoolEntryFromSource } from "../src/workflow/task-pool-entry.js";
import {
  createExistingTaskContextPackage,
  createTaskSource,
} from "./support/task-pool-fixtures.js";

test("task context package build maps task entries into package shape", () => {
  const entry = taskPoolEntryFromSource(createTaskSource({
    id: "task-001",
    fileName: "task-001.yaml",
    title: "生成上下文包",
    priority: "normal",
  }));

  const taskPackage = taskContextPackageFromEntry(entry);

  assert.equal(taskPackage.packageId, "task-context-package:tasks/task-001.yaml");
  assert.equal(taskPackage.currentWorkStage, "task-pool");
  assert.deepEqual(taskPackage.source, {
    path: "tasks/task-001.yaml",
    format: "yaml",
    contentHash: "unavailable",
  });
  assert.deepEqual(taskPackage.taskDraft, {
    id: "task-001",
    name: "生成上下文包",
    kind: "feature",
    priority: "normal",
    goal: "监听 tasks 目录变化",
    acceptanceCriteria: ["修改任务源文件后界面自动刷新"],
    maxIterations: "default",
  });
  assert.equal(taskPackage.recognition.outcome, "recognized");
  assert.equal(taskPackage.qualityGate.outcome, "pass");
});

test("task context package build preserves existing workflow artifacts", () => {
  const entry = taskPoolEntryFromSource(createTaskSource());
  const existing = createExistingTaskContextPackage({
    currentWorkStage: "closed",
    artifacts: {
      taskCloseout: {
        artifactId: "taskCloseout",
        body: { outcome: "merged" },
        appendedAt: "2026-05-21T00:00:00.000Z",
      },
    },
    agentRuns: [{ runId: "execution-agent:001" }],
    timeline: [{ artifactType: "taskCloseout" }],
  });

  const taskPackage = taskContextPackageFromEntry(entry, existing);

  assert.equal(taskPackage.currentWorkStage, "closed");
  assert.equal(taskPackage.artifacts.taskCloseout.body.outcome, "merged");
  assert.deepEqual(taskPackage.agentRuns, [{ runId: "execution-agent:001" }]);
  assert.deepEqual(taskPackage.timeline, [{ artifactType: "taskCloseout" }]);
  assert.notEqual(taskPackage.artifacts, existing.artifacts);
});

test("task context packages build matches entries by package id", () => {
  const entries = [
    taskPoolEntryFromSource(createTaskSource({ id: "task-001" })),
    taskPoolEntryFromSource(createTaskSource({ id: "task-002" })),
  ];

  const packages = taskContextPackagesFromEntries(entries, {
    taskContextPackages: [
      createExistingTaskContextPackage({
        packageId: "task-context-package:tasks/task-002.yaml",
        currentWorkStage: "review-agent",
      }),
    ],
  });

  assert.deepEqual(packages.map((taskPackage) => taskPackage.currentWorkStage), [
    "task-pool",
    "review-agent",
  ]);
});
