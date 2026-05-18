import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaskContextPackage } from "../src/workflow/task-context-package.js";

const taskPool = {
  entries: [
    {
      id: "task-003",
      packageId: "task-context-package:tasks/task-003.yaml",
      sourceFile: "task-003.yaml",
      title: "监听任务文件变化",
      type: "feature",
      priority: "high",
      status: "ready",
      parsed: {
        id: "task-003",
        title: "监听任务文件变化",
        type: "feature",
        priority: "high",
        description: "监听 tasks 目录变化",
        acceptance: ["修改任务源文件后界面自动刷新"],
      },
      validation: { status: "valid", errors: [] },
    },
  ],
};

const executionIntent = {
  recommendedPackageId: "task-context-package:tasks/task-003.yaml",
  confidence: "high",
  selectionReasoning: ["唯一 high 优先级任务"],
  candidateComparison: [
    {
      packageId: "task-context-package:tasks/task-003.yaml",
      decision: "selected",
      reason: "优先级最高",
    },
  ],
  executionBrief: {
    goalInterpretation: "监听 tasks 目录变化",
    expectedOutcome: ["修改任务源文件后界面自动刷新"],
    implementationHints: ["检查文件监听链路"],
    riskSignals: ["文件事件可能重复触发"],
    openQuestions: [],
  },
};

test("builds a task context package with execution intent artifact", () => {
  const taskContextPackage = buildTaskContextPackage({
    taskPool,
    executionIntent,
  });

  assert.equal(taskContextPackage.packageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(taskContextPackage.currentWorkStage, "task-recommender");
  assert.equal(taskContextPackage.qualityGate.outcome, "pass");
  assert.equal(taskContextPackage.taskDraft.name, "监听任务文件变化");
  assert.equal(taskContextPackage.artifacts.executionIntent.confidence, "high");
});

test("applies execution admission append request to the task context package", () => {
  const taskContextPackage = buildTaskContextPackage({
    taskPool,
    executionIntent,
    appendRequest: {
      packageId: "task-context-package:tasks/task-003.yaml",
      artifactType: "executionAuthorization",
      artifact: {
        authorizedAt: "2026-05-18T10:00:00.000Z",
        termination: {
          maxIterations: 3,
        },
      },
    },
  });

  assert.equal(taskContextPackage.currentWorkStage, "execution-admission");
  assert.equal(
    taskContextPackage.artifacts.executionAuthorization.authorizedAt,
    "2026-05-18T10:00:00.000Z",
  );
});

test("returns null before an execution intent selects a task", () => {
  assert.equal(buildTaskContextPackage({ taskPool }), null);
});
