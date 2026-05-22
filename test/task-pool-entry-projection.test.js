import { test } from "node:test";
import assert from "node:assert/strict";
import {
  entryStatusFromPackage,
  taskPoolEntriesFromSources,
  taskPoolEntryFromSource,
} from "../src/workflow/task-pool.js";
import { createTaskSource } from "./support/task-pool-fixtures.js";

test("task pool entry projection maps valid and invalid task sources", () => {
  assert.deepEqual(taskPoolEntryFromSource(createTaskSource({
    id: "task-001",
    fileName: "task-001.yaml",
    title: "任务标题",
    priority: undefined,
    validation: { status: "invalid", errors: ["title missing"] },
  })), {
    id: "task-001",
    packageId: "task-context-package:tasks/task-001.yaml",
    sourceFile: "task-001.yaml",
    title: "任务标题",
    type: "feature",
    priority: null,
    status: "blocked",
    parsed: {
      id: "task-001",
      title: "任务标题",
      type: "feature",
      priority: undefined,
      description: "监听 tasks 目录变化",
      acceptance: ["修改任务源文件后界面自动刷新"],
    },
    validation: { status: "invalid", errors: ["title missing"] },
  });
});

test("task pool entries skip sources that failed parsing", () => {
  const entries = taskPoolEntriesFromSources([
    createTaskSource({ id: "ready" }),
    createTaskSource({ id: "broken", parseError: "YAML parse error" }),
  ]);

  assert.deepEqual(entries.map((entry) => entry.id), ["ready"]);
});

test("task pool entry status follows workflow package stage for ready tasks", () => {
  assert.equal(entryStatusFromPackage(
    { status: "ready" },
    { currentWorkStage: "human-decision" },
  ), "human-decision");
  assert.equal(entryStatusFromPackage(
    { status: "ready" },
    { currentWorkStage: "task-pool" },
  ), "ready");
  assert.equal(entryStatusFromPackage(
    { status: "blocked" },
    { currentWorkStage: "execution-agent" },
  ), "blocked");
});
