import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaskPoolViews } from "../src/workflow/task-pool.js";

test("task pool views expose candidate tasks and attention packages", () => {
  const views = buildTaskPoolViews([
    {
      packageId: "task-context-package:tasks/ready.yaml",
      currentWorkStage: "task-pool",
      qualityGate: { outcome: "pass" },
      recognition: { outcome: "recognized" },
      taskDraft: { id: "ready", name: "Ready" },
    },
    {
      packageId: "task-context-package:tasks/active.yaml",
      currentWorkStage: "human-decision",
      qualityGate: { outcome: "pass" },
      recognition: { outcome: "recognized" },
      taskDraft: { id: "active", name: "Active" },
    },
    {
      packageId: "task-context-package:tasks/blocked.yaml",
      currentWorkStage: "task-pool",
      qualityGate: { outcome: "fail" },
      recognition: { outcome: "incomplete" },
      taskDraft: { id: "blocked", name: "Blocked" },
    },
  ]);

  assert.deepEqual(views.candidateTasks, [
    {
      packageId: "task-context-package:tasks/ready.yaml",
      taskDraft: { id: "ready", name: "Ready" },
    },
  ]);
  assert.deepEqual(views.needsAttention, ["task-context-package:tasks/blocked.yaml"]);
  assert.deepEqual(views.brokenContent, []);
});
