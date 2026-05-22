import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeExecutionIntentArtifact } from "../src/workflow/execution-intent-artifact.js";

function validArtifact(overrides = {}) {
  return {
    recommendedPackageId: "task-context-package:tasks/task-003.yaml",
    confidence: "high",
    selectionReasoning: ["优先级最高"],
    candidateComparison: [
      {
        packageId: "task-context-package:tasks/task-003.yaml",
        decision: "selected",
        reason: "优先级最高",
      },
      {
        packageId: "task-context-package:tasks/task-004.yaml",
        decision: "deferred",
        reason: "依赖较多",
      },
    ],
    executionBrief: {
      goalInterpretation: "监听 tasks 目录变化",
      expectedOutcome: ["界面自动刷新"],
      implementationHints: ["检查 /api/events"],
      riskSignals: ["文件事件可能重复触发"],
      openQuestions: [],
    },
    ...overrides,
  };
}

test("execution intent artifact normalizes the current schema", () => {
  assert.deepEqual(normalizeExecutionIntentArtifact(validArtifact()), validArtifact());
});

test("execution intent artifact rejects unsupported confidence", () => {
  assert.throws(
    () => normalizeExecutionIntentArtifact(validArtifact({ confidence: "certain" })),
    /confidence must be high, medium, or low/,
  );
});

test("execution intent artifact requires exactly one selected candidate matching recommendation", () => {
  assert.throws(
    () => normalizeExecutionIntentArtifact(validArtifact({
      candidateComparison: [
        {
          packageId: "task-context-package:tasks/task-003.yaml",
          decision: "deferred",
          reason: "not selected",
        },
      ],
    })),
    /exactly one selected item/,
  );
  assert.throws(
    () => normalizeExecutionIntentArtifact(validArtifact({
      candidateComparison: [
        {
          packageId: "task-context-package:tasks/task-004.yaml",
          decision: "selected",
          reason: "wrong package",
        },
      ],
    })),
    /selected packageId must match recommendedPackageId/,
  );
});
